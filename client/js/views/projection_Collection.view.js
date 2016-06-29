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
        }

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
                    parameter: {
                        size: t_size,
                        scales: {
                            x: d3.scale.linear().range([t_left, t_left + t_size * 0.9]),
                            y: d3.scale.linear().range([t_top, t_top + t_size * 0.9]),
                        },
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
                self.listenTo(self.collection, "ProjectionCollection__ShowProjection", self.updateProjection)
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

            clearAll: function(){
                var self = this;
                self.d3el.selectAll("g")
                .remove();
            },
        },Base));

        return Projection_CollectionView;
    });
