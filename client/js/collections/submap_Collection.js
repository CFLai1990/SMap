define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'SubMap_Model',
], function(require, Mn, _, $, Backbone, SubMap_Model) {
    'use strict';

    var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv;

    var SubMap_Collection = Backbone.Collection.extend({
        model: SubMap_Model,

        initialize: function(){
            var t_defaults = {
                count: 0,
                sampleCount: null,
                dimensions: null,
                dimCount: null,
                dimRange: null,
                subIndex: null,
            };
            _.extend(this, t_defaults);
        },

        update: function(v_options) {
            this.clearAll();
            _.extend(this, v_options);
            this.sampling();
        },

        sampling: function () {
            var t_dimC = this.dimCount = this.dimensions.length, t_top = Math.pow(2, t_dimC) - 1, t_all,
            t_count = 0, t_indeces = d3.set();
            var log = Math.log, round = Math.round, min = Math.min, max = Math.max;
            var self = this, t_dimRange = [max(self.dimRange[0], 2), min(self.dimRange[1], self.dimCount)], t_sum = 0;
            var tt_count = 0;
            for(var i = t_dimRange[0]; i <= t_dimRange[1]; i++){
                var t_mid1 = 1, t_mid2 = 1;
                for(var j = 1; j <= i; j++){
                    tt_count ++;
                    t_mid1 *= j;
                    t_mid2 *= (t_dimC - j + 1);
                }
                t_sum += t_mid2 / t_mid1;
            }
            t_all = min(self.sampleCount, t_sum);
            console.info("SubMapCollection: sampling rate: " + (t_all / t_sum * 100).toFixed(2) + "%");
            while(t_count < t_all){
                var t_st = self.binaryRandom([0, t_top], t_dimRange);
                if(!t_indeces.has(t_st)){
                    t_indeces.add(t_st);
                    t_count ++;
                }
            }
            self.subIndex = t_indeces;
            self.count = t_count;
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
                count: 0,
                sampleCount: null,
                dimensions: null,
                dimCount: null,
                dimRange: null,
                subIndex: null,
            };
            _.extend(this, t_defaults);
            this.trigger("SubMap_Collection__ClearAll");
        },
    });
    return SubMap_Collection;
});
