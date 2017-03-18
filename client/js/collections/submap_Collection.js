define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'combinations',
    'SubMap_Model',
], function(require, Mn, _, $, Backbone, Combinations, SubMap_Model) {
    'use strict';

    var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv, sum=numeric.sum;

    $.whenWithProgress = function(arrayOfPromises) {
       var cntr = 0;
       for (var i = 0; i < arrayOfPromises.length; i++) {
           arrayOfPromises[i].done();
       }
       return jQuery.when.apply(jQuery, arrayOfPromises);
    }

    var SubMap_Collection = Backbone.Collection.extend({
        model: SubMap_Model,

        initialize: function(){
            let t_defaults = {
                clusters: null,
                clusterLevel: null,
                dimensions: null,
                dimCount: null,
                dimRange: null,
                dimCoverage: null,
                subIndex: null,
                sampleCount: null,
                sampleFinishCount: null,
                dataDist: null,
                projDist: null,
                dimDist: null,
                projection: null,
                colors: null,
                timer: null,
                tpModel: {
                    wordmap: null,
                    DTMatrix: null,
                    TWMatrix: null,
                    TDims: null,
                },
                minElemFunc: Config.get("minElemFunc"),
                viewObject: null,
            };
            _.extend(this, t_defaults);
        },

        update: function(v_options) {
            this.clearAll();
            _.extend(this, v_options);
            let t_df1 = $.Deferred(), 
                t_df2 = $.Deferred(), 
                t_df3 = $.Deferred(), 
                t_df4 = $.Deferred(),
                t_df5 = $.Deferred(),
                t_dfs1 = [t_df4.promise(), t_df5.promise()];
                // t_df6 = $.Deferred();
            this.sampling(t_df1);
            $.when(t_df1).done(n => {
                this.getKNNGraphs(t_df2);
            });
            $.when(t_df2).done(n => {
                this.getDistances(t_df3);
            });
            $.when(t_df3).done(n => {
                this.getColors(t_df4);
                // this.getSubspaceClusters(t_df5);
            });
            $.when(t_df4).done(n => {
                this.getSubHierClusters(t_df5);
                // this.getSubspaceClusters(t_df5);
            });
            $.when(t_df5).done(n => {
                this.trigger("SubMapCollection__ShowMap");
            });
            // $.whenWithProgress(t_dfs1)
            // .done(() => {
            //     this.trigger("SubMapCollection__ShowMap");
            // });
            // $.when(t_df4).done(n => {
            //     this.trainModel(t_df5);
            // });
            // $.when(t_df5).done(n => {
            //     this.getModel(t_df6);
            // });
            // $.when(t_df6).done(n => {
            //     this.drawModel();
            // });
        },

        sampling: function (v_df) {
            var t_dimC = this.dimCount = this.dimensions.length, t_top = Math.pow(2, t_dimC) - 1, t_all,
            t_count = 0;
            var log = Math.log, round = Math.round, min = Math.min, max = Math.max;
            var self = this, t_dimRange = [max(self.dimRange[0], 2), min(self.dimRange[1], self.dimCount)], t_sum = 0;
            self.timer = new Date().getTime();
            for(var i = t_dimRange[0]; i <= t_dimRange[1]; i++){
                let t_comb = Combinations(t_dimC, i);
                t_sum += t_comb;
            }
            t_all = min(self.sampleCount, t_sum);
            self.trigger("SubMapCollection__Panda",{
                subDims: t_dimC,
                subRange: t_dimRange,
                subNumber: t_all,
            }, "subCodes = Subsampling(subRange, subDims, subNumber)", function(v_codes){
                for(let i = 0; i < v_codes.length; i++){
                    let t_code = v_codes[i].join("");
                    self.add(new SubMap_Model({code: t_code, dimensions: self.dimensions, id: i, collection: self}))
                }
                self.subIndex = v_codes;
                self.sampleCount = v_codes.length;
                console.info("SubMapCollection: Sampling rate: " + (v_codes.length / t_sum * 100).toFixed(2) + "%");
                v_df.resolve();
            }, true, true);
            // while(t_count < t_all){
            //     var t_st = self.binaryRandom([0, t_top], t_dimRange);
            //     if(!t_indeces.has(t_st)){
            //         t_indeces.add(t_st);
            //         self.add(new SubMap_Model({code: t_st, dimensions: self.dimensions, id: t_count, collection: self}));
            //         t_count ++;
            //     }
            // }
            // self.subIndex = t_indeces;
            // self.sampleCount = t_count;
        },

        sampleFinish: function (v_id){
            var self = this;
            if(!self.sampleFinishCount){
                self.sampleFinishCount = 0;
            }
            self.sampleFinishCount ++;
        },

        getKNNGraphs: function(v_df){
            var self = this;
            self.trigger("SubMapCollection__Panda",{
                subK: Config.get("KNN_K"),
                precision: Config.get("KNN_Precision"),
            }, "subGraphs = KNNGraphs(subCodes, normData, subK, precision)", function(){
                if(v_df){
                    v_df.resolve();
                }
            }, true, false);
        },

        getDistances: function (v_df){
            var t_df0 = $.Deferred(), t_df1 = $.Deferred(), t_dfs = [];
            t_dfs.push(t_df0.promise());
            t_dfs.push(t_df1.promise());
            this.trigger("SubMapCollection__Panda",{
            }, "subDataDist = KNNGDistance(subGraphs, subK)", (v_dist) => {
                this.dataDist = v_dist;
                t_df0.resolve();
                t_df1.resolve();
            }, true, true);
            // self.trigger("SubMapCollection__Panda",{
            // }, "subDimDist = DimDistance(subCodes)", function(v_dist){
            //     self.dimDist = v_dist;
            //     t_df1.resolve();
            // }, true, true);
            $.whenWithProgress(t_dfs)
            .done(function(){
                if(v_df){
                    v_df.resolve();
                }
            });
        },

        getDistanceMatrix: function(){
            var self = this, t_interval = ((new Date().getTime()) - self.timer) / 1000, t_i = 0, t_dist = [];
            console.info("SubMapCollection: Sampling finished in " + t_interval + "s");
            for(var i = 0; i < self.sampleCount; i++){
                t_dist.push([]);
            }
            self.each(function(t_sub, t_ind){
                var t_KNNG = t_sub.KNNG;
                t_dist[t_ind][t_ind] = 0;
                for(var i = t_ind + 1; i < self.sampleCount; i++){
                    var tt_KNNG = self.get(i).KNNG, tt_dist = Basic.KNNGDistance(t_KNNG, tt_KNNG);
                    t_dist[t_ind][i] = t_dist[i][t_ind] = tt_dist;
                }
            });
            self.dataDist = t_dist;
        },

        getColors: function(v_df, v_distMat){
            if(v_distMat){
                this.trigger("SubMapCollection__Panda",{
                    subDistMat: v_distMat,
                    projType: "MDS",
                    projDim: 3,
                }, "subColors = Projection(subDistMat, projType, projDim)", v_proj => {
                    v_df.resolve(v_proj);
                }, true, true);
            }else{
                this.trigger("SubMapCollection__Panda",{
                    projType: "MDS",
                    projDim: 3,
                }, "subColors = Projection(subDataDist, projType, projDim)", v_proj => {
                    this.colors = v_proj;
                    let t_length = v_proj.length, 
                        t_tempDist = Basic.initArray(t_length, t_length);
                    for(let i = 0; i < t_length - 1; i++){
                        for(let j = i + 1; j < t_length; j++){
                            t_tempDist[i][j] = t_tempDist[j][i] = Basic.getDistance(v_proj[i], v_proj[j]);
                        }
                    }
                    this.projDist = t_tempDist;
                    v_df.resolve();
                }, true, true);
            }
        },

        // getClsParameters: function(v_dist){
        //         let t_length = v_dist.length,
        //             t_min_elems = Math.round(t_length / 8);
        //         // t_min_elems = t_min_elems < 6?t_min_elems:6;
        //         console.log(t_min_elems);
        //         if(t_min_elems < 2){
        //             t_min_elems = 2;
        //         }
        //         let t_prs = {
        //                 eps: null,
        //                 min_elems: t_min_elems,
        //             };
        //         if(t_prs.min_elems < 1){
        //             t_prs.min_elems = 1;
        //         }
        //         let t_sum = new Array();
        //         for(let i = 0; i < t_length; i++){
        //             let t_dist = new Array(...v_dist[i]);
        //             t_dist.sort();
        //             t_sum.push(t_dist[t_prs.min_elems]);
        //         }
        //         t_sum.sort();
        //         t_prs.eps = eval(t_sum.join("+")) / t_length;
        //         return t_prs;
        // },

        getSubHierClusters: function(v_df, v_isTemp = false, v_length, v_projMat){
            let t_distType = Config.get("clusterDistMat"),
                t_clusterParameters,
                t_clusterCommand,
                t_length = v_isTemp?v_length:this.sampleCount,
                t_min_elems = Math.round(t_length / 8),
                t_level = this.clusterLevel = Config.get("clusterLevels"),
                t_newMaxLevel = 0;
            if(t_min_elems < 2){
                t_min_elems = 2;
            }
            switch(t_distType){
                case "projection":
                    t_clusterParameters = {
                        'tempDist': v_isTemp?v_projMat:this.projDist,
                        'DC_min_elems': t_min_elems,
                        'DC_level': t_level,
                    }
                    t_clusterCommand = "DBSCANHierarchy(tempDist, DC_min_elems, DC_level)";
                break;
                case "original":
                    let t_dataDistName = v_isTemp?"subDistMat":"subDataDist";
                    t_clusterParameters = {
                        'DC_min_elems': t_min_elems,
                        'DC_level': t_level,
                    };
                    t_clusterCommand = "DBSCANHierarchy(" + t_dataDistName + ", DC_min_elems, DC_level)";
                break;
            }
            let t_getLevel = (v_clsIDs, v_indeces, v_level, v_maxLevel) => {
                let t_cls = new Map(),
                    t_out = new Array();
                if(v_level > t_newMaxLevel){
                    t_newMaxLevel = v_level;
                }
                for(let i = 0; i < v_clsIDs.length; i++){
                    let t_id = v_clsIDs[i][v_level],
                        t_ind = v_indeces[i];
                    if(t_id < 0){
                        t_out.push(i);
                    }else{
                        if(t_cls.get(t_id) == null){
                            t_cls.set(t_id, [i]);
                        }else{
                            t_cls.get(t_id).push(i);
                        }
                    }
                }
                t_cls = Basic.mapToArray(t_cls);
                let t_all = [...t_cls, ...t_out],
                    t_return = new Array();
                if(t_out.length == 0 && t_cls.length == 1){
                    t_all = t_all[0];
                }
                for(let i = 0; i < t_all.length; i++){
                    if(t_all[i].length == null){
                        t_return.push(v_indeces[t_all[i]]);
                    }else{
                        if(v_level <= v_maxLevel){
                            let t_clsIDs = new Array(),
                                t_indeces = new Array();
                            for(let j = 0; j < t_all[i].length; j++){
                                let t_i = t_all[i][j];
                                t_clsIDs.push(v_clsIDs[t_i]);
                                t_indeces.push(v_indeces[t_i]);
                            }
                            t_return.push(t_getLevel(t_clsIDs, t_indeces, v_level + 1, v_maxLevel));
                        }else{
                            let t_nextLevel = new Array();
                            for(let j = 0; j < t_all[i].length; j++){
                                let t_i = t_all[i][j];
                                t_nextLevel.push(v_indeces[t_i]);
                            }
                            t_return.push(t_nextLevel);
                        }
                    }
                }
                return t_return;
            };
            this.trigger("SubMapCollection__Panda", t_clusterParameters, t_clusterCommand, v_clusters => {
                let t_indeces = new Array(),
                    t_maxLevel = 0;
                for(let i = 0; i < v_clusters.length; i++){
                    t_indeces.push(i);
                }
                let t_cls = t_getLevel(v_clusters, t_indeces, 0, t_level - 1, t_maxLevel),
                    t_clsLevel = t_newMaxLevel;
                if(t_clsLevel == 0){
                    t_clsLevel = 1;
                    t_cls = [t_cls];
                }
                if(!v_isTemp){
                    this.clusters = t_cls;
                    this.clusterLevel = t_clsLevel;
                }
                if(v_df){
                    v_df.resolve(t_cls, t_clsLevel);
                }
            }, true, true);
        },

        // getSubspaceClusters: function(v_df){
        //     let t_distType = Config.get("clusterDistMat"),
        //         t_clusterParameters,
        //         t_clusterCommand,
        //         t_parameters,
        //         t_eps,
        //         t_min_elems;
        //     switch(t_distType){
        //         case "projection":
        //             t_parameters = this.getClsParameters(this.projDist);
        //             t_eps = t_parameters.eps;
        //             t_min_elems = t_parameters.min_elems;
        //             t_clusterParameters = {
        //                 'tempDist': this.projDist,
        //                 'DC_eps': t_eps,
        //                 'DC_min_elems': t_min_elems,
        //             }
        //             t_clusterCommand = "DBSCAN(tempDist, DC_eps, DC_min_elems)";
        //         break;
        //         case "original":
        //             t_parameters = this.getClsParameters(this.dataDist);
        //             t_eps = t_parameters.eps;
        //             t_min_elems = t_parameters.min_elems;
        //             t_clusterParameters = {
        //                 'DC_eps': t_eps,
        //                 'DC_min_elems': t_min_elems,
        //             };
        //             t_clusterCommand = "DBSCAN(subDataDist, DC_eps, DC_min_elems)";
        //         break;
        //     }
        //     this.trigger("SubMapCollection__Panda", t_clusterParameters, t_clusterCommand, v_clusters => {
        //         let t_clusters = {
        //             clusters: new Array(),
        //             outliers: new Array(),
        //         };
        //         for(let i = 0; i < v_clusters.length; i++){
        //             if(v_clusters[i] < 0){
        //                 t_clusters.outliers.push(i);
        //             }else{
        //                 let t_index = v_clusters[i],
        //                     t_cluster = t_clusters.clusters[t_index];
        //                 if(t_cluster == null){
        //                     t_cluster = new Array();
        //                 }
        //                 t_cluster.push(i);
        //                 t_clusters.clusters[t_index] = t_cluster;
        //             }
        //         }
        //         this.clusters = t_clusters;
        //         v_df.resolve();
        //     }, true, true);
        // },

        getProjection: function(v_df){
            var self = this, t_w = Config.get("KNNGDistWeight");
            var t_df0 = $.Deferred(), t_df1 = $.Deferred(), t_dfs = [];
            t_dfs.push(t_df0.promise());
            t_dfs.push(t_df1.promise());
            self.trigger("SubMapCollection__Panda",{
                projType: "MDS",
                projDim: 2,
                tw: t_w,
                ntw: 1-t_w,
            }, "subProj = Projection(Multiply(subDataDist, tw) + Multiply(subDimDist, ntw), projType, projDim)", v_proj => {
                this.projection = v_proj;
                t_df0.resolve();
            }, true, true);
            self.trigger("SubMapCollection__Panda",{
                projType: "MDS",
                projDim: 3,
            }, "subColors = Projection(subDataDist, projType, projDim)", v_proj => {
                this.colors = v_proj;
                t_df1.resolve();
            }, true, true);
            // t_df1.resolve();
            $.whenWithProgress(t_dfs)
            .done(function(){
                self.trigger("SubMapCollection__ShowMap");
                if(v_df){
                    v_df.resolve();
                }
            });
            //         self.projection = MDS.byDistance(self.dist);
            //         self.trigger("SubMapCollection__ShowProjection");
        },

        getCoverage: function(v_indeces){
            let t_dimLength = this.dimCount,
                t_coverage = new Array(t_dimLength),
                t_codes = this.subIndex;
            t_coverage.dimLength = t_dimLength;
            for(let i = 0; i < t_dimLength; i++){
                t_coverage[i] = 0;
            }
            for(let i = 0; i < v_indeces.length; i++){
                let t_code = t_codes[v_indeces[i]];
                for(let j = 0; j < t_dimLength; j++){
                    if(t_code[j] == 1){
                        t_coverage[j]++;
                    }
                }
            }
            return t_coverage;
        },

        trainModel: function(v_df){
            var self = this;
            self.trigger("SubMapCollection__Panda",{
                modelType: "LDA",
                modelName: Config.get("currentData") + "_model",
                topicN: Config.get("TOPIC_N"),
            }, "KNNGModel(modelType, subGraphs, subK, topicN, modelName)", v_result => {
                if(v_df){
                    v_df.resolve();
                }
            }, true, false);
        },

        getModel: function(v_df){
            var self = this;
            var t_df0 = $.Deferred(), t_df1 = $.Deferred(), t_df2 = $.Deferred(), t_dfs = [];
            t_dfs.push(t_df0.promise());
            t_dfs.push(t_df1.promise());
            t_dfs.push(t_df2.promise());
            self.trigger("SubMapCollection__Panda",{
                oprType: "get",
                oprTarget: "wordmap",
            }, "KNNGOperate(modelName, oprType, oprTarget)", v_result => {
                let t_wordmap = [];
                for(let i = 0; i < v_result.length; i++){
                    let t_word = v_result[i], t_from = t_word[0], t_to = t_word[1];
                    let t_name = t_from + "_" + t_to;
                    t_wordmap[i] = {
                        from: t_from,
                        to: t_to,
                    };
                }
                this.tpModel.wordmap = t_wordmap;
                t_df0.resolve();
            }, true, true);
            self.trigger("SubMapCollection__Panda",{
                oprType: "get",
                oprTarget: "doc_topic",
            }, "KNNGOperate(modelName, oprType, oprTarget)", v_result => {
                this.tpModel.DTMatrix = v_result;
                t_df1.resolve();
            }, true, true);
            self.trigger("SubMapCollection__Panda",{
                oprType: "get",
                oprTarget: "topic_word",
            }, "KNNGOperate(modelName, oprType, oprTarget)", v_result => {
                this.tpModel.TWMatrix = v_result;
                t_df2.resolve();
            }, true, true);
            $.whenWithProgress(t_dfs)
            .done(function(){
                if(v_df){
                    v_df.resolve();
                }
            });
        },

        drawModel: function(){
            let t_td = trans(dot(trans(this.subIndex), this.tpModel.DTMatrix));
            for(let i = 0; i < t_td.length; i++){
                t_td[i] = div(t_td[i], sum(t_td[i]));
            }
            this.tpModel.TDims = t_td;
            this.trigger("SubMapCollection__ShowModels");
        },

        binaryRandom: function (v_range, v_limits){
            var self = this, t_dim = self.dimCount, t_num, t_st, t_length, t_sign;
            while(!t_sign){
                t_num = _.random(v_range[0], v_range[1]), t_st = t_num.toString(2), t_sign = false, t_length = t_st.length;
                if(t_length >= v_limits[0] && t_length <= v_limits[1]){
                    if(t_length < t_dim) {
                        for(var i = 0; i < (t_dim - t_length); i++){
                            t_st = "0" + t_st;
                        }
                    }
                    var t_arr = t_st.split(""), t_count = 0;
                    for(var i in t_arr){
                        if(t_arr[i] == "1"){
                            t_count ++;
                        }
                    }
                    if(t_count >= v_limits[0] && t_count <= v_limits[1]){
                        t_sign = true;
                    }
                }
            }
            return t_st;
        },

        clearAll: function(){
            this.reset();
            this.initialize();
            this.trigger("SubMapCollection__ClearAll");
        },
    });
    return SubMap_Collection;
});
