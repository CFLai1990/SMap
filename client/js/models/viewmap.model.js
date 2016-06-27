/**
 * Created by Chufan Lai at 2015/1/12
 * viewpoint model
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'config',
], function(require, Mn, _, $, Backbone, Config) {
    'use strict';

    var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv;

    var viewpoint =  Backbone.Model.extend({

        initialize: function(v_options){
            var t_defaults = {
                focus: [],
                focusID: null,
                coordinates: [],
                position: [],
                optimization: null,
                name: null,
            };
            _.extend(this, t_defaults);
            _.extend(this, v_options);
        },
    });
    return viewpoint;
});
