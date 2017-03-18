define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'combinations',
    'SubList_Model',
], function(require, Mn, _, $, Backbone, Combinations, SubList_Model) {
    'use strict';

    var SubList_Collection = Backbone.Collection.extend({
        model: SubList_Model,

        initialize: function(){
            let t_defaults = {
            };
            _.extend(this, t_defaults);
        },

        update: function(){
            this.trigger("SubListCollection__UpdateData");
        },

        clearAll: function(){
            this.initialize();
        },
    });
    return SubList_Collection;
});
