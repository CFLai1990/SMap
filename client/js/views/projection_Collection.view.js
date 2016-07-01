define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'datacenter',
    'config',
    'Base',
    'SubMap_ModelView',
    ], function(require, Mn, _, $, Backbone, Datacenter, Config, Base, SubMap_ModelView) {
        'use strict';

        String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        };

        var Projection_CollectionView = Mn.CollectionView.extend(_.extend({

            tagName: 'g',

            attributes: {
                "id":"Projection",
            },

            childView: SubMap_ModelView,

            childEvents: {
            },

            childViewOptions: {
                layout: null,
            },

            initialize: function (options) {
                var self = this;
                var t_width = parseFloat($("#Projection_CollectionViewSVG").css("width")),
                t_height = parseFloat($("#Projection_CollectionViewSVG").css("height")),
                t_size = Math.min(t_width, t_height);
                var t_left = (t_width - t_size) / 2 + t_size * 0.05, t_top = (t_height - t_size) / 2 + t_size * 0.05
                var t_defaults = {
                    scale: {
                        x: d3.scale.linear().range([t_left, t_left + t_size * 0.9]),
                        y: d3.scale.linear().range([t_top, t_top + t_size * 0.9]),
                    },
                    fontSize: 12,
                    ready: false,
                    hover: {
                        timer: null,
                        time: 1500,
                        shown: null,
                    },
                    transition: Config.get("transition"),
                    parameter: {
                        size: t_size,
                        r: 6,
                    },
                };
                options = options || {};
                _.extend(this, t_defaults);
                _.extend(this, options);
                this.layout = Config.get("childviewLayout");
                this.bindAll();
            },

            onShow: function(){
                var self = this;
            },

            bindAll: function(){
                var self = this;
                self.listenTo(Datacenter, "SubMapCollectionView__ShowProjection", self.getProjection);
                self.listenTo(self.collection, "ProjectionCollection__ShowProjection", self.showProjection);
                self.listenTo(self.collection, "ProjectionCollection__ClearAll", self.clearAll);
            },

            getProjection: function(v_code){
                var self = this, t_projection = self.collection.getProjection(v_code);
            },

            updateProjection: function(v_proj){
                var self = this, t_scales = self.parameter.scales, t_r = self.parameter.r, t_max = Config.get("data").maxVector;
                t_scales.x.domain([-t_max * 0.8, t_max * 0.8]);
                t_scales.y.domain([-t_max * 0.8, t_max * 0.8]);
                self.clearAll();
                self.d3el.selectAll(".ProjectionPoint")
                .data(v_proj)
                .enter()
                .append("g")
                .classed("ProjectionPoint", true)
                .attr("id", function(t_d, t_i){
                    return "ProjectionPoint_" + t_i;
                })
                .attr("transform", function(t_d){
                    return "translate(" + Basic.scale(t_scales, t_d) + ")";
                })
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", t_r);
            },

            showProjection: function(v_start, v_cord){
            //     console.log("EEEEEEE");
            var tt_data = Config.get("data"), self = this, t_scale = this.scale, t_shorter = 0.9, t_longer  = 0.95, t_dimensions = tt_data.dimensions.values();
            var t_dark = Config.get("lightColor").dark, t_max = Config.get("data").maxVector * 0.8, t_range = [-t_max, t_max];
            var tt_proj = self.collection.projection;
            if(!this.ready){
                var t_proj = [], t_data = tt_data.data;
                this.scale.x.domain(t_range);
                this.scale.y.domain(t_range);
                t_scale = this.scale;
                var t_pts = this.d3el.append("g")
                .classed("ProjectionPoints", true);
                var t_g = t_pts.selectAll(".ProjectionPoint")
                .data(tt_proj)
                .enter()
                .append("g")
                .attr("class","ProjectionPoint")
                .attr("index", function(t_d, t_i){
                    return t_i;
                })
                .attr("id",function(t_d, t_i){
                    return "ProjectionPoint_"+t_i;
                })
                .attr("transform",function(t_d, t_i){
                    var t_pos = Basic.scale(t_scale, t_d);
                    t_proj[t_i] = t_pos;
                    return "translate(" + t_pos + ")";
                })
                .attr("data-html", true)
                .attr("data-original-title", function(t_d, t_i){
                    var t_text = "";
                    tt_data.dimensions.forEach(function(t_key, t_value){
                        t_text += t_value+": "+t_data[t_i][t_value]+"</br>";
                    });
                    return t_text;
                })
                .attr("data-placement", "bottom")
                .on("mouseover", function(){
                    var t_self = this;
                    clearTimeout(self.hover.timer);
                    self.hover.timer = setTimeout(function(){
                        $(t_self).tooltip("show");
                    }, self.hover.time);
                })
                .on("mouseout", function(){
                    clearTimeout(self.hover.timer);
                    self.hover.timer = null;
                    $(this).tooltip("hide");
                });
                $(t_g[0])
                .tooltip({
                    container: "#leftTop",
                    trigger: "manual",
                });
                t_g.append("circle")
                .attr("cx",0)
                .attr("cy",0)
                .attr("color", function(t_d, t_i){
                    return t_dark;
                })
                .attr("r",function(t_d, t_i){
                    return self.parameter.r;
                })
                .attr("fill", function(t_d, t_i){
                    return $(this).attr("color");
                });
                self.projection = t_proj;
                //draw axes
                var t_axes = this.d3el.append("g")
                .classed("ProjectionAxes", true);
                var t_cords = self.collection.coordinates;
                var t_axis = t_axes.selectAll(".ProjectionAxis")
                .data(t_cords)
                .enter()
                .append("g")
                .attr("class", "ProjectionAxis")
                .attr("id", function(t_d, t_i){
                    return "ProjectionAxis_" + t_i;
                })
                t_axis.append("line")
                .attr("x1", t_scale.x(0))
                .attr("y1", t_scale.y(0))
                .attr("x2", function(t_d){ return t_scale.x(t_d[0] * t_max * t_shorter);})
                .attr("y2", function(t_d){ return t_scale.y(t_d[1] * t_max * t_shorter);});
                t_axis.append("text")
                .attr("tlength", function(t_d, t_i){
                    var t_text = t_dimensions[t_i];
                    var t_size = t_text.visualLength(self.fontSize);
                    return t_size.join(",");
                })
                .attr("x", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.x(t_d[0] * t_max * t_longer) - t_size[0] / 2;
                })
                .attr("y", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.y(t_d[1] * t_max * t_longer) + t_size[1] / 2;
                })
                .text(function(t_d, t_i){
                    return t_dimensions[t_i];
                });
                this.ready = true;
            }else{
                var t_max = t_scale.x.domain();
                t_max = t_max[1];
                var t_frame = self.collection.frames, t_last = (self.collection.nowFrame == t_frame - 1), t_proj = [];
                var t_axes = this.d3el.selectAll(".ProjectionAxis")
                .data(self.collection.coordinates);
                t_axes.select("line")
                .transition()
                .ease("linear")
                .duration(self.transition.interval)
                .attr("x2", function(t_d){ return t_scale.x(t_d[0] * t_max * t_shorter);})
                .attr("y2", function(t_d){ return t_scale.y(t_d[1] * t_max * t_shorter);});
                t_axes.select("text")
                .attr("x", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.x(t_d[0] * t_max * t_longer) - t_size[0] / 2;
                })
                .attr("y", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.y(t_d[1] * t_max * t_longer) + t_size[1] / 2;
                });
                var t_projection = this.collection.projection;
                this.d3el.selectAll(".ProjectionPoint")
                .data(this.collection.projection)
                .transition()
                .ease("linear")
                .duration(self.transition.interval)
                .attr("transform",function(t_d){
                    var t_i = parseInt($(this).attr("index"));
                    var t_pos = Basic.scale(t_scale, t_projection[t_i]);
                    if(t_last){
                        t_proj[t_i] = t_pos;
                    }
                    return "translate("+t_pos+")";
                });
                this.projection = t_proj;
                if(v_start){
                    this.d3el.selectAll(".ProjectionPoints circle")
                    .attr("color", function(t_d){
                        return t_dark;
                    })
                    .transition()
                    .duration(self.transition.duration)
                    .ease("linear")
                    .attr("r", function(){
                        return self.parameter.r;
                    });
                }
            }
        },

        clearAll: function(){
            var self = this;          
            self.d3el.selectAll("g")
            .remove();     
            var t_defaults = {
                fontSize: 12,
                ready: false,
                hover: {
                    timer: null,
                    time: 1500,
                    shown: null,
                },
                transition: Config.get("transition"),
            };
            _.extend(this, t_defaults);
        },
    },Base));

return Projection_CollectionView;
});
