define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'config',
    'backbone',
], function(require, Mn, _, $, Config, Backbone) {
    'use strict';

    var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv, det = numeric.det, norm2Squared = numeric.norm2Squared, norm1 = numeric.norm1;

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
                });
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
            var t_df1 = $.Deferred(), t_max = 0;
            self.trigger("Data__Panda", {
                    data: t_array,
                }, "normData = Normalize(data)",
                function(vv_data){
                    self.dataArray = vv_data;
                    t_df1.resolve(vv_data);
            }, true, true);
            $.when(t_df1).done(function(vv_data){
                for(var i in vv_data){
                    var t_l = norm2(vv_data[i]);
                    if(t_l > t_max){
                        t_max = t_l;
                    }
                }
                Config.get("data").maxVector = t_max;
                self.trigger("Data__DataReady");
            });
            // var tt_array = this.dataArray = MDS.normalizeData(t_array), t_max = 0;
            // for(var i in tt_array){
            //     var t_l = norm2(tt_array[i]);
            //     if(t_l > t_max){
            //         t_max = t_l;
            //     }
            // }
            // Config.get("data").maxVector = t_max;
            // this.trigger("Data__DataReady");
        },

        // clustering: function(v_data){
        //     this.getClusteringParameters(v_data);
        //     return this.getClusters(v_data);
        // },

        // getClusteringParameters: function(v_data){
        //     var t_dist = MDS.getSquareDistances(v_data), t_range = 0, t_n = this.distParameters.density = 6;
        //     for(var i in t_dist){
        //         var t_d = t_dist[i].slice(0);
        //         t_d.sort();
        //         t_range += t_d[t_n];
        //     }
        //     t_range = t_range / t_dist.length * 1.1;
        //     this.distParameters.range = t_range;
        // },

        // getClusters: function(v_data){
        //     var t_dbscan = new DBSCAN();
        //     var tt_clusters = t_dbscan.run(v_data, this.distParameters.range, this.distParameters.density);
        //     var t_cluster = [];
        //     for(var i in tt_clusters){
        //         for(var j in tt_clusters[i]){
        //             t_cluster[tt_clusters[i][j]] = i;
        //         }
        //     }
        //     Config.set("cluster", t_cluster);
        //     Config.set("clusterNumber", tt_clusters.length);
        //     return tt_clusters;
        // },

        temp_handle_mc1: function(){

        },
    });
    return data;
});
