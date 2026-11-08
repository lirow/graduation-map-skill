/* Leaflet-backed adapter for the small map surface used by the graduation page. */
(() => {
  'use strict';
  const latLng = point => L.latLng(point[1],point[0]);
  const features = data => data?.type==='FeatureCollection' ? data.features : data?.type==='Feature' ? [data] : [];
  function matches(feature, filter) {
    if(!filter)return true;
    const value=feature.properties?.[filter[1]?.[1]];
    if(filter[0]==='==')return value===filter[2];
    if(filter[0]==='in')return (filter[2]?.[1]||[]).includes(value);
    return true;
  }

  class OfflineMap extends L.Evented {
    constructor(options) {
      super();
      this.renderer='2d';
      this._sources=new Map();this._layers=new Map();this._delegates=[];
      this._padding={top:0,bottom:0,left:0,right:0};
      this._container=document.getElementById(options.container);
      this._map=L.map(this._container,{
        zoomControl:false,attributionControl:false,preferCanvas:false,
        minZoom:options.minZoom,maxZoom:options.maxZoom,zoomSnap:0,
        zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,
        center:latLng(options.center),zoom:options.zoom,worldCopyJump:false
      });
      L.control.attribution({prefix:false}).addTo(this._map).addAttribution('Leaflet · Made with Natural Earth');
      L.control.scale({position:'bottomleft',imperial:false,maxWidth:90}).addTo(this._map);
      this._center=options.center;
      for(const [id,source] of Object.entries(options.style.sources))this.addSource(id,source);
      for(const layer of options.style.layers)this.addLayer(layer);
      this._map.on('move',()=>this.fire('render'));
      this._map.on('moveend',()=>{
        const p=this._padding,offset=L.point((p.left-p.right)/2,(p.top-p.bottom)/2);
        const center=this._map.unproject(this._map.project(this._map.getCenter()).add(offset));
        this._center=[center.lng,center.lat];
        this.fire('render');
      });
      this._map.on('zoom',()=>{this.fire('zoom');this.fire('render');});
      this._map.on('zoomend',()=>{this._drawAll();this.fire('render');});
      this._loadTimer=setTimeout(()=>this.fire('load'),0);
    }
    on(type, layer, handler) {
      if(typeof layer==='string'){this._delegates.push({type,layer,handler});return this;}
      return super.on(type,layer,handler);
    }
    _delegate(type,id,feature,event) {
      for(const item of this._delegates)if(item.type===type&&item.layer===id)item.handler({features:[feature],originalEvent:event.originalEvent});
    }
    addSource(id,spec) {
      const source={...spec,_data:spec.data,setData:data=>{
        source._data=data;
        for(const [layerId,layer] of this._layers)if(layer.spec.source===id)this._draw(layerId);
        this.fire('render');
      }};
      this._sources.set(id,source);return this;
    }
    getSource(id) {return this._sources.get(id);}
    removeSource(id) {this._sources.delete(id);return this;}
    addLayer(spec) {this._layers.set(spec.id,{spec:{...spec,layout:{...spec.layout}},view:null});this._draw(spec.id);return this;}
    getLayer(id) {return this._layers.get(id)?.spec;}
    removeLayer(id) {
      const layer=this._layers.get(id);if(layer?.view)this._map.removeLayer(layer.view);
      this._layers.delete(id);return this;
    }
    setFilter(id,filter) {const layer=this._layers.get(id);if(layer){layer.spec.filter=filter;this._draw(id);}return this;}
    setLayoutProperty(id,key,value) {const layer=this._layers.get(id);if(layer){layer.spec.layout[key]=value;this._draw(id);}return this;}
    getLayoutProperty(id,key) {return this._layers.get(id)?.spec.layout[key];}
    _drawAll() {for(const id of this._layers.keys())this._draw(id);}
    _draw(id) {
      const layer=this._layers.get(id),spec=layer.spec,z=this.getZoom();
      if(layer.view){this._map.removeLayer(layer.view);layer.view=null;}
      if(spec.layout.visibility==='none'||z<(spec.minzoom??0)||z>=(spec.maxzoom??24))return;
      // Edge styling is included in the fill layers; 3D volumes and the grid
      // are unnecessary in the CPU/SVG compatibility renderer.
      if(['ocean','world-edge','province-edge','province-volume','grid'].includes(id))return;
      const input=this.getSource(spec.source)?._data;
      const selected=features(input).filter(feature=>matches(feature,spec.filter));
      const style=feature=>{
        if(id==='world-fill')return {color:'#38505a',weight:.5,fillColor:'#18313c',fillOpacity:.8,interactive:false};
        if(id==='overseas-fill')return {color:'#638e83',weight:.6,fillColor:'#49766c',fillOpacity:.6,interactive:false};
        if(id==='province-fill')return {color:feature.properties.count?'#a6c7b4':'#53727a',weight:.75,fillColor:feature.properties.count?'#346364':'#203e4b',fillOpacity:z<7?.9:.35};
        if(id==='province-selected')return {color:'#e6bc83',weight:2,fill:false,interactive:false};
        if(id==='routes')return {color:'#e6bc83',weight:1.5,opacity:.55,interactive:false};
        return {color:'#e6bc83',weight:1,fillColor:'#e6bc83',fillOpacity:.9};
      };
      layer.view=L.geoJSON({type:'FeatureCollection',features:selected},{
        style,
        interactive:id==='province-fill'||id==='school-points',
        pointToLayer:(_,point)=>L.circleMarker(point,{
          radius:id==='school-halo'?11:id==='school-selected'?9:id==='origin'?5:4,
          color:'#122f37',weight:id==='school-points'?1.5:0,
          fillColor:'#e6bc83',fillOpacity:id==='school-halo'?.12:id==='school-selected'?.2:1
        }),
        onEachFeature:(feature,view)=>{
          for(const type of ['click','mouseover','mouseout'])view.on(type,event=>this._delegate(type==='mouseover'?'mouseenter':type==='mouseout'?'mouseleave':type,id,feature,event));
        }
      }).addTo(this._map);
    }
    getContainer() {return this._container;}
    getCanvas() {return this._container.querySelector('.leaflet-overlay-pane svg')||this._container;}
    getZoom() {return this._map.getZoom();}
    getCenter() {const p=this._map.getCenter();return {lng:p.lng,lat:p.lat};}
    getPitch() {return 0;}
    getBearing() {return 0;}
    isMoving() {return false;}
    project(point) {return this._map.latLngToContainerPoint(latLng(point));}
    setPadding(padding) {this._padding={...this._padding,...padding};return this;}
    easeTo(options={}) {
      this.setPadding(options.padding||{});
      const zoom=options.zoom??this.getZoom(),center=options.center||this._center;
      this._center=center;
      const p=this._padding,offset=L.point((p.left-p.right)/2,(p.top-p.bottom)/2);
      const target=this._map.unproject(this._map.project(latLng(center),zoom).subtract(offset),zoom);
      this._map.setView(target,zoom,{animate:false});this.fire('render');return this;
    }
    fitBounds(bounds,options={}) {
      const points=Array.isArray(bounds)?bounds:bounds.toArray();
      const box=L.latLngBounds(points.map(latLng)),p={...this._padding,...options.padding};
      this._padding=p;
      this._center=[box.getCenter().lng,box.getCenter().lat];
      this._map.fitBounds(box,{paddingTopLeft:[p.left,p.top],paddingBottomRight:[p.right,p.bottom],maxZoom:options.maxZoom,animate:false});
      this.fire('render');return this;
    }
    zoomIn() {this._map.zoomIn();return this;}
    zoomOut() {this._map.zoomOut();return this;}
    resize() {this._map.invalidateSize({animate:false});this.fire('render');return this;}
    remove() {clearTimeout(this._loadTimer);this._map.remove();this.off();}
  }
  window.createOfflineMap=options=>new OfflineMap(options);
})();
