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
        getDiag=numeric.getDiag, inv=numeric.inv;

    var SubMap_Collection = Backbone.Collection.extend({
        model: SubMap_Model,

        initialize: function(){
            var t_defaults = {
                dimensions: null,
                dimCount: null,
                dimRange: null,
                subIndex: null,
                sampleCount: null,
                sampleFinishCount: null,
                dist: null,
                projection: null,
                timer: null,
            };
            _.extend(this, t_defaults);
        },

        update: function(v_options) {
            this.clearAll();
            _.extend(this, v_options);
            let t_df = $.Deferred();
            this.sampling(t_df);
            $.when(t_df).done(n => {
                this.getDistances();
                this.getProjection();
            });
        },

        sampling: function (v_df) {
            var t_dimC = this.dimCount = this.dimensions.length, t_top = Math.pow(2, t_dimC) - 1, t_all,
            t_count = 0, t_indeces = new Set();
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
                    t_indeces.add(t_code);
                    self.add(new SubMap_Model({code: t_code, dimensions: self.dimensions, id: i, collection: self}))
                }
                self.subIndex = t_indeces;
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

        getDistances: function (){
            var self = this, t_timer = setInterval(function(){
                if(self.sampleFinishCount == self.sampleCount){
                    clearInterval(t_timer);
                    self.getDistanceMatrix();
                }
            }, 200);
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
            self.dist = t_dist;
        },

        getProjection: function(){
            var self = this, t_timer;
            t_timer = setInterval(function(){
                if(self.dist){
                    clearInterval(t_timer);
                    self.projection = MDS.byDistance(self.dist);
                    self.trigger("SubMapCollection__ShowProjection");
                }
            }, 200);
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
            var t_defaults = {
                dimensions: null,
                dimCount: null,
                dimRange: null,
                subIndex: null,
                sampleCount: null,
                sampleFinishCount: null,
                dist: null,
                projection: null,
                timer: null,
            };
            _.extend(this, t_defaults);
            this.trigger("SubMapCollection__ClearAll");
        },
    });
    return SubMap_Collection;
});
