define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'datacenter',
    'config',
    'text!templates/submap_Model.tpl'
], function(require, Mn, _, $, Backbone, Datacenter, Config, Tpl) {
    'use strict';
    var SubMap_ModelView = Mn.ItemView.extend({
        tagName: 'g',

        template: _.template(Tpl),

        initialize: function (options) {
            var self = this;
            _.extend(this, options);
            this.bindAll();
        },

        bindAll: function(){
        },

        onShow: function(){
            var self = this;
        },
    });

    return SubMap_ModelView;
});
