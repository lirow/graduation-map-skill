/*
 * Pure data preparation. This file does not read the DOM, create a map, or mutate
 * the supplied data/GeoJSON. Re-run it after changing the inline data variables.
 */
(() => {
  'use strict';

  const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
  const validPosition = (lng, lat) => typeof lng === 'number' && typeof lat === 'number' &&
    Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat > -90 && lat < 90;
  const coordinate = value => Array.isArray(value) && validPosition(value[0], value[1]) ? [value[0], value[1]] : null;
  const normalizeLongitude = value => ((value + 180) % 360 + 360) % 360 - 180;

  function list(value, label) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error(`${label}必须是数组。`);
    return value;
  }
  function indexById(records, label) {
    const index = new Map();
    records.forEach((record, i) => {
      if (!record || typeof record !== 'object' || !text(record.id)) {
        throw new Error(`${label}第 ${i + 1} 条缺少有效的字符串 id。`);
      }
      if (index.has(record.id)) throw new Error(`${label}存在重复 id：${record.id}。请为每条记录设置不同的 id。`);
      index.set(record.id, {...record});
    });
    return index;
  }

  function insideRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function unwrapRing(ring, reference) {
    let previous = reference;
    return ring.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map(p => {
      let lng = p[0];
      if (previous != null) {
        while (lng - previous > 180) lng -= 360;
        while (lng - previous < -180) lng += 360;
      }
      previous = lng;
      return [lng, p[1]];
    });
  }
  function ringMetrics(ring) {
    let crossSum = 0, x = 0, y = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      crossSum += cross;
      x += (ring[j][0] + ring[i][0]) * cross;
      y += (ring[j][1] + ring[i][1]) * cross;
    }
    return {area:Math.abs(crossSum / 2), center:Math.abs(crossSum) > 1e-12 ? [x / (3 * crossSum), y / (3 * crossSum)] : null};
  }

  // Use an interior point in the largest land polygon, not the bounding box of
  // distant islands. This is only a country-label anchor, never a school point.
  function geometryAnchor(geometry) {
    if (!geometry) return null;
    if (geometry.type === 'Point') return coordinate(geometry.coordinates);
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    let dominant = null;
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) continue;
      const outer = unwrapRing(polygon[0]);
      if (outer.length < 3) continue;
      const metrics = ringMetrics(outer);
      if (!dominant || metrics.area > dominant.area) {
        dominant = {...metrics, outer, holes:polygon.slice(1).map(ring => unwrapRing(ring, outer[0][0]))};
      }
    }
    if (!dominant) return null;
    const contains = p => insideRing(p, dominant.outer) && !dominant.holes.some(r => insideRing(p, r));
    const clean = p => p && coordinate([normalizeLongitude(p[0]), Math.max(-85, Math.min(85, p[1]))]);
    if (dominant.center && contains(dominant.center)) return clean(dominant.center);
    const ys = dominant.outer.map(p => p[1]), minY = Math.min(...ys), maxY = Math.max(...ys);
    let best = null;
    for (const fraction of [.5, .35, .65, .2, .8]) {
      const y = minY + (maxY - minY) * fraction, crossings = [];
      for (const ring of [dominant.outer, ...dominant.holes]) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[j], b = ring[i];
          if ((a[1] > y) !== (b[1] > y)) crossings.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
        }
      }
      crossings.sort((a,b) => a-b);
      for (let i = 1; i < crossings.length; i++) {
        const width = crossings[i] - crossings[i-1], point = [(crossings[i] + crossings[i-1]) / 2, y];
        if (width > 0 && contains(point) && (!best || width > best.width)) best = {width, point};
      }
    }
    return clean(best?.point || dominant.outer[0]);
  }

  window.createClassMapModel = (data = {}, provincesGeo = {}, worldGeo = {}) => {
    const homeCountry = text(data.meta?.homeCountry);
    const schools = indexById(list(data.schools, '学校数据'), '学校数据');
    const studentIndex = indexById(list(data.students, '毕业生数据'), '毕业生数据');
    const regionConfigs = new Map();
    for (const region of list(data.regions, '地区配置')) {
      const name = text(region?.name);
      if (!name) throw new Error('地区配置缺少 name。');
      if (regionConfigs.has(name)) throw new Error(`地区配置存在重复名称：${name}。`);
      regionConfigs.set(name, {...region, centroid:coordinate(region.centroid)});
    }
    const rawRegionOf = record => {
      if (!record) return null;
      const province = text(record.province), country = text(record.country);
      if (country && homeCountry && country !== homeCountry) return country;
      return province || (country && country !== homeCountry ? country : null);
    };
    const regionOf = record => {
      if (!record) return null;
      const linkedSchool = schools.get(record.schoolId);
      return rawRegionOf(linkedSchool) || rawRegionOf(record);
    };
    const isLocated = record => Boolean(record && validPosition(record.lng, record.lat));
    const isCampusConfirmed = record => Boolean(record &&
      (['user_confirmed','source_confirmed'].includes(record.campusStatus) || record.coordinateStatus === 'campus_confirmed'));
    // assumed：按学校主校区的推定值，既不是已确认，也不该混进“尚待确认”里。
    const isCampusAssumed = record => Boolean(record && record.campusStatus === 'assumed');
    const students = [...studentIndex.values()].map(student => {
      const school = schools.get(student.schoolId);
      return {...student, province:regionOf(student), country:text(school?.country) || text(student.country) || homeCountry};
    });
    const counts = new Map(), schoolStudents = new Map();
    for (const student of students) {
      if (student.province) counts.set(student.province, (counts.get(student.province) || 0) + 1);
      if (schools.has(student.schoolId)) {
        if (!schoolStudents.has(student.schoolId)) schoolStudents.set(student.schoolId, []);
        schoolStudents.get(student.schoolId).push(student);
      }
    }
    const referencedSchools = [...schools.values()].filter(s => schoolStudents.has(s.id));
    const activeSchools = referencedSchools.filter(isLocated);
    const worldFeatures = Array.isArray(worldGeo.features) ? worldGeo.features : [];
    const worldByName = new Map();
    for (const feature of worldFeatures) {
      for (const key of ['name','nameEn','NAME','ADMIN','admin']) {
        const name = text(feature.properties?.[key]);
        if (name) worldByName.set(name, feature);
      }
    }
    const provinceByName = new Map();
    const domesticNames = new Set();
    for (const feature of Array.isArray(provincesGeo.features) ? provincesGeo.features : []) {
      const name = text(feature.properties?.name);
      if (!name) continue;
      domesticNames.add(name);
      provinceByName.set(name, {...feature, properties:{...feature.properties, name,
        shortName:feature.properties.shortName || name, centroid:coordinate(feature.properties.centroid),
        isCountry:false, geoName:name}});
    }
    const foreignNames = new Set();
    for (const record of [...referencedSchools, ...students]) {
      const country = text(record.country);
      if (country && country !== homeCountry && !domesticNames.has(country)) foreignNames.add(country);
    }
    const isOverseas = region => {
      if (!region || region === homeCountry) return false;
      const config = regionConfigs.get(region);
      if (typeof config?.isCountry === 'boolean') return config.isCountry;
      if (domesticNames.has(region)) return false;
      return foreignNames.has(region) || worldByName.has(region);
    };
    const averageSchoolPosition = region => {
      const points = activeSchools.filter(s => regionOf(s) === region);
      if (!points.length) return null;
      const longitudeReference = points[0].lng;
      let lng = 0, lat = 0;
      for (const point of points) {
        let x = point.lng;
        while (x - longitudeReference > 180) x -= 360;
        while (x - longitudeReference < -180) x += 360;
        lng += x; lat += point.lat;
      }
      return [normalizeLongitude(lng / points.length), lat / points.length];
    };
    const anchorCache = new Map();
    const regionCenter = region => {
      if (!region) return null;
      if (anchorCache.has(region)) return anchorCache.get(region)?.slice() || null;
      const config = regionConfigs.get(region);
      const worldFeature = worldByName.get(config?.geoName || region);
      const center = coordinate(config?.centroid) ||
        coordinate(provinceByName.get(region)?.properties.centroid) || averageSchoolPosition(region) ||
        geometryAnchor(worldFeature?.geometry);
      anchorCache.set(region, center);
      return center?.slice() || null;
    };
    // Add every configured and populated region, including names with no geometry.
    // Such names are still usable in lists; their map anchor deliberately stays null.
    for (const name of new Set([...provinceByName.keys(), ...regionConfigs.keys(), ...counts.keys()])) {
      const config = regionConfigs.get(name), previous = provinceByName.get(name);
      const worldFeature = worldByName.get(config?.geoName || name);
      provinceByName.set(name, {...(previous || {}), properties:{...(previous?.properties || {}),
        name, shortName:config?.shortName || previous?.properties?.shortName || name,
        centroid:regionCenter(name), isCountry:isOverseas(name),
        geoName:config?.geoName || worldFeature?.properties?.name || name, count:counts.get(name) || 0}});
    }
    const sortedProvinces = [...counts.keys()].sort((a,b) => counts.get(b)-counts.get(a) || a.localeCompare(b,'zh'));
    const unknown = students.filter(s => !s.province);
    const overseasRegions = sortedProvinces.filter(isOverseas);
    const overseasGeometryNames = [...new Set(overseasRegions.map(name => provinceByName.get(name).properties.geoName))];
    const stats = {
      total:students.length,
      located:students.filter(s => isLocated(schools.get(s.schoolId))).length,
      provinceKnown:students.filter(s => s.province && !isOverseas(s.province)).length,
      overseas:students.filter(s => isOverseas(s.province)).length,
      unknown:unknown.length,
      needsReview:students.filter(s => s.nameStatus === 'needs_review' || !text(s.name) || s.name.includes('□')).length,
      confirmedNames:students.filter(s => s.nameStatus === 'user_confirmed').length,
      schoolCount:referencedSchools.length,
      locatedSchools:activeSchools.length,
      unlocatedSchools:referencedSchools.length - activeSchools.length,
      domesticRegions:sortedProvinces.length - overseasRegions.length,
      overseasRegions:overseasRegions.length,
      campusUnconfirmed:referencedSchools.filter(s => !isCampusConfirmed(s) && !isCampusAssumed(s)).length,
      campusAssumed:referencedSchools.filter(isCampusAssumed).length
    };
    return {schools, students, counts, schoolStudents, referencedSchools, activeSchools,
      provinceByName, sortedProvinces, unknown, stats, regionOf, regionCenter,
      isOverseas, isLocated, isCampusConfirmed, isCampusAssumed, overseasGeometryNames};
  };
})();
