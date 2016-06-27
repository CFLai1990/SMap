/**
 * Created by Chufan Lai at 2015/12/14
 * view for each viewpoint projection
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'datacenter',
    'config',
    'ViewpointView',
    'text!templates/viewmap.tpl'
], function(require, Mn, _, $, Backbone, Datacenter, Config, ViewpointView, Tpl) {
    'use strict';
    var ViewmapView = Mn.ItemView.extend({
        tagName: 'g',

        template: _.template(Tpl),

        initialize: function (options) {
            var self = this;
            var t_defaults = {
                layout: {}
            };
            options = options || {};
            _.extend(this, t_defaults);
            _.extend(this, options);
            this.bindAll();
        },

        bindAll: function(){
        },

        onShow: function(){
            var self = this;
        },
    });

    return ViewmapView;
});
