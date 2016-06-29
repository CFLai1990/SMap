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

        var SubMap_CollectionView = Mn.CollectionView.extend(_.extend({

            tagName: 'g',

            attributes: {
                "id":"SubMap",
            },

            childView: SubMap_ModelView,

            childEvents: {
            },

            childViewOptions: {
                layout: null,
            },

            initialize: function (options) {
                var self = this;
                var t_width = parseFloat($("#SubMap_CollectionViewSVG").css("width")),
                t_height = parseFloat($("#SubMap_CollectionViewSVG").css("height")),
                t_size = Math.min(t_width, t_height);
                var t_left = (t_width - t_size) / 2 + t_size * 0.05, t_top = (t_height - t_size) / 2 + t_size * 0.05
                var t_defaults = {
                    parameter: {
                        size: t_size,
                        scales: {
                            x: d3.scale.linear().range([t_left, t_left + t_size * 0.9]).domain([0,1]),
                            y: d3.scale.linear().range([t_top, t_top + t_size * 0.9]).domain([0,1]),
                        },
                        r: 6,
                    },
                };
                options = options || {};
                _.extend(this, options);
                _.extend(this, t_defaults);
                this.layout = Config.get("childviewLayout");
                this.bindAll();
            },

            onShow: function(){
                var self = this;
            },

            bindAll: function(){
                var self = this;
                self.listenTo(self.collection, "SubMapCollection__ShowProjection", self.showProjection);
            },

            showProjection: function(){
                var self = this, t_projection = self.collection.projection, t_scales = self.parameter.scales, t_r = self.parameter.r;
                self.clearAll();
                self.d3el.selectAll(".SubMapModel")
                .data(self.collection.models)
                .enter()
                .append("g")
                .classed("SubMapModel", true)
                .attr("id", function(t_d){
                    return "SubMapModel_" + t_d.id;
                })
                .attr("transform", function(t_d){
                    var t_ind = t_d.id, t_pos = t_projection[t_ind];
                    return "translate(" + Basic.scale(t_scales, t_pos) + ")";
                })
                .on("click", function(t_d){
                    self.collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__ShowProjection", data: t_d.subspace});
                })
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", t_r)
                .append("title")
                .text(function(t_d){
                    return t_d.code;
                });
            },

            clearAll: function(){
                var self = this;
                self.d3el.selectAll("g").remove();
            },
        },Base));

        return SubMap_CollectionView;
    });
