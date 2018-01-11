(function (factory, window) {

    // 定义一个依赖于`Leaflet`的AMD模块
    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory); 
    } 
    
    // 定义一个依赖于`Leaflet`的Common JS模块
    else if (typeof exports === 'object') {
        module.exports = factory(require('leaflet'));
    }

    // 将你的插件附加到全局变量`L`上
    if (typeof window !== 'undefined' && window.L) {
        window.L.FlowLayer = factory(L);

        window.L.flowLayer = function(paths, opts) {
            return new window.L.FlowLayer(paths, opts);
        };
    }
}(function (L) {

    'use strict';

    var FlowLayer = (L.Layer ? L.Layer : L.Class).extend({

        initialize: function (paths, options) {
            /*
            [{
                coords:[[36.1554,116.24577],[37.154,116.2456],...],
                count:0,
                currentIndex:0
            },{
                coords:[[38.1554,116.24577],[39.154,116.2456],...],
                count:0,
                currentIndex:0
            },...]*/
            this._paths = paths;
            L.setOptions(this, options);
        },

        setLatLngs: function (paths) {
            this._paths = paths;
            return this.redraw();
        },

        addLatLng: function (path) {
            this._paths.push(path);
            return this.redraw();
        },

        setOptions: function (options) {
            L.setOptions(this, options);
            this._updateOptions();
            return this.redraw();
        },

        redraw: function () {
            if (!this._frame && this._map && !this._map._animating) {
                this._frame = L.Util.requestAnimFrame(this._redraw, this);
            }
            return this;
        },

        onAdd: function (map) {
            this._map = map;

            if (!this._canvas) {
                this._initCanvas();
            }

            var pane = map.createPane('flow');
            pane.appendChild(this._canvas);

            map.on('moveend', this._reset, this);

            if (map.options.zoomAnimation && L.Browser.any3d) {
                map.on('zoomanim', this._animateZoom, this);
            }

            this._reset();
        },

        onRemove: function (map) {

            clearInterval(this._flowInterval);
            
            map.getPanes().overlayPane.removeChild(this._canvas);

            map.off('moveend', this._reset, this);

            if (map.options.zoomAnimation) {
                map.off('zoomanim', this._animateZoom, this);
            }
        },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        _initCanvas: function () {
            var canvas = this._canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer');
            canvas.id='flow';

            var originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
            canvas.style[originProp] = '50% 50%';

            var size = this._map.getSize();
            canvas.width  = size.x;
            canvas.height = size.y;

            var animated = this._map.options.zoomAnimation && L.Browser.any3d;
            L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

            this._updateOptions();
        },

        _updateOptions: function () {

            clearTimeout(this._wait);
            this._wait = setTimeout(this._reset(),500);
        },

        _reset: function () {
            clearInterval(this._flowInterval);
    
            var flowContext = this._canvas.getContext('2d');
            flowContext.clearRect(0,0,this._canvas.width,this._canvas.height);

            var topLeft = this._map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);

            var size = this._map.getSize();

            this._canvas.width = size.x;
            
            this._canvas.height = size.y;
            
            this._redraw();
            //setTimeout(this._updateOptions(),50);
        },

        _redraw: function () {
            console.log("Done!");
            //this._flowInterval&&clearInterval(this._flowInterval);

            this._drawpaths();
            
        },

        _drawpaths:function(){
            var flowContext = this._canvas.getContext('2d');
            flowContext.strokeStyle = 'rgba(0,150,200,.4)';
            flowContext.lineWidth = 2;
            flowContext.fillStlye = '#fff';
            // fade out the existing canvas a little bit. this is what creates the trail effect
                flowContext.save();
                flowContext.globalCompositeOperation = 'destination-out';
                flowContext.globalAlpha = 0.1;
                flowContext.fillRect(0,0,this._canvas.width,this._canvas.height);
                flowContext.restore();

                // now go through all paths and draw each to its next coordinate
                for (var c in this._paths) {
                // if next will be past the end...
                    if (this._paths[c].currentIndex + 1 >= this._paths[c].coords.length) {
                        if (this._paths[c].count > 50) {
                            // only start over if this has run 50 frames. prevents short paths from looping annoyingly quickly
                            this._paths[c].currentIndex = 0;
                            this._paths[c].count = 0;
                            this._paths[c].idle = false;
                        } else {
                            // if we're not there yet, wait
                            this._paths[c].idle = true;
                            this._paths[c].count++;
                            continue;
                        }
                    }
                    // draw from current point to next point
                    var x = this._paths[c].coords[this._paths[c].currentIndex][0];
                    var y = this._paths[c].coords[this._paths[c].currentIndex][1];
                    var latlng = L.latLng(y, x);
                    var thispoi = this._map.latLngToContainerPoint(latlng);

                    this._paths[c].currentIndex ++;
                    var newX = this._paths[c].coords[this._paths[c].currentIndex][0];
                    var newY = this._paths[c].coords[this._paths[c].currentIndex][1];
                    var newlatlng = L.latLng(newY, newX);
                    var newpoi = this._map.latLngToContainerPoint(newlatlng);

                    flowContext.beginPath();
                    flowContext.moveTo(thispoi.x, thispoi.y);
                    flowContext.lineTo(newpoi.x, newpoi.y);
                    this._paths[c].count ++;
                    flowContext.stroke(); 
                }
        },
        _animateZoom: function (e) {
            var scale = this._map.getZoomScale(e.zoom),
                offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

            if (L.DomUtil.setTransform) {
                L.DomUtil.setTransform(this._canvas, offset, scale);

            } else {
                this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
            }
        }
    });
    // 运行你的插件

    // 完成后返回你的插件
    return FlowLayer;
}, window));