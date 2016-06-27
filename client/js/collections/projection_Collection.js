define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'Projection_Model',
], function(require, Mn, _, $, Backbone, Projection_Model) {
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
            };
            _.extend(this, t_defaults);
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
