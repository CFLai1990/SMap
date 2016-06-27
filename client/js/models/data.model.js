/**
 * Created by Chufan Lai at 2015/12/14
 * model for a dataset
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'config',
    'backbone',
    'densityClustering',
], function(require, Mn, _, $, Config, Backbone, DensityClustering) {
    'use strict';
    var data =  Backbone.Model.extend({
        defaults: {
            data: null,
            dimensions: null,
            dataArray: null,
            sampling: false,
        },

        initialize: function(){
        },

        update: function(options){
            var t_defaults = {
                distArray: null,
                distParameters: {
                    range: null,
                    density: null,
                },
                clusters: null,
            };
            _.extend(this, options);
            _.extend(this, t_defaults);
            this.parseData();
        },

        parseData: function(){
            if(this.sampling){
                var t_data = [];
                this.data.forEach(function(t_d){
                    var t_r = Math.random();
                    if(t_r<0.08)
                        t_data.push(t_d);
                })
                this.data = t_data;
            }
            var self = this, t_array = [];
            this.dimensions = d3.map(this.dimensions);
            Config.get("data").dimensions = this.dimensions;
            self.data.forEach(function(d){
                self.dimensions.forEach(function(t_i, i){
                    d[i] = +d[i];
                });
                t_array.push(_.toArray(d));
            });
            Config.get("data").data = this.data;
            this.dataArray = MDS.normalizeData(t_array);
            this.distArray = MDS.getSquareDistances(this.dataArray);
            var t_sub = [];
            this.dimensions.forEach(function(d){
                t_sub.push(true);
            });
            Config.set("subspace", t_sub);
            Config.set("subspaceAll", t_sub);
            // this.clusters = this.clustering(this.dataArray);
            this.trigger("Data__DataReady");
        },

        clustering: function(v_data){
            this.getClusteringParameters(v_data);
            return this.getClusters(v_data);
        },

        getClusteringParameters: function(v_data){
            var t_dist = MDS.getSquareDistances(v_data), t_distArray = [], t_range = 0, t_n = this.distParameters.density = 6;
            for(var i in t_dist){
                var t_d = t_dist[i].slice(0);
                t_d.sort();
                t_range += t_d[t_n];
            }
            t_range = t_range / t_dist.length * 1.1;
            this.distParameters.range = t_range;
        },

        getClusters: function(v_data){
            var t_dbscan = new DBSCAN();
            var tt_clusters = t_dbscan.run(v_data, this.distParameters.range, this.distParameters.density);
            var t_cluster = [];
            for(var i in tt_clusters){
                for(var j in tt_clusters[i]){
                    t_cluster[tt_clusters[i][j]] = i;
                }
            }
            Config.set("cluster", t_cluster);
            Config.set("clusterNumber", tt_clusters.length);
            return tt_clusters;
        },
    });
    return data;
});
