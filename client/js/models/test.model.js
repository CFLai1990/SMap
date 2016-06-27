/**
 * Created by tangzhi.ye at 2015/11/24
 * model for default setting
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone'
], function(require, Mn, _, $, Backbone) {
    'use strict';
    var test =  Backbone.Model.extend({
        defaults: {
            firstName:"Tangzhi",
            lastName:"Ye"
        },
    });
    test.Collection = Backbone.Collection.extend({
        model: test.Model
    });
    return test;
});
