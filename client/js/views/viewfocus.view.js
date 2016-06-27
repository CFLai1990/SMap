/**
 * Created by Chufan Lai at 2016/02/03
 * view for each viewpoint focus
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'datacenter',
    'config',
    'text!templates/viewfocus.tpl',
    'Base',
], function(require, Mn, _, $, Backbone, Datacenter, Config, Tpl, Base) {
    'use strict';

         String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        }

    var ViewfocusView = Mn.ItemView.extend(_.extend({

        tagName:"g",

        class: "ViewfocusView",

        events: {
        },

        template: _.template(Tpl),

        attributes:{
        },

        initialize: function (v_options) {
        },
    }, Base));

    return ViewfocusView;
});
