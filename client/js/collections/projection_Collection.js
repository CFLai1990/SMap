define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'config',
    'backbone',
    'Projection_Model',
], function(require, Mn, _, $, Config, Backbone, Projection_Model) {
    'use strict';

    var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv;

    var Projection_Collection = Backbone.Collection.extend({
        model: Projection_Model,

        initialize: function(){
            var t_defaults = {
                count: 0,
                data: null,
                projection: null,
            };
            _.extend(this, t_defaults);
        },

        getProjection: function(v_subspace){
            var self = this, t_data = trans(Config.get("data").array), t_array = [];
            for(var i in v_subspace){
                if(v_subspace[i]){
                    t_array.push(t_data[i]);
                }
            }
            self.data = trans(t_array);
            // var t_cords = MDS.getCoordinates(self.data, true);
            self.projection = MDS.byData(self.data);
            self.trigger("ProjectionCollection__ShowProjection", self.projection);
        },

        clearAll: function(){
            this.reset();
            var t_defaults = {
                count: 0,
                data: null,
            };
            _.extend(this, t_defaults);
            this.trigger("Projection_Collection__ClearAll");
        },
    });
    return Projection_Collection;
});
