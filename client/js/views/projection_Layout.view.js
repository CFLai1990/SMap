define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'd3',
    'Base',
    'Projection_CollectionView',
    'datacenter',
    'text!templates/projection_Layout.tpl'
], function(require, Mn, _, $, Backbone, d3, Base, Projection_CollectionView, Datacenter, Tpl){
    'use strict';
    return Mn.LayoutView.extend(_.extend({

        tagName:'svg',

        template: _.template(Tpl),

        regions:{
            'Projection_CollectionView':'#Projection_CollectionView',
        },

        attributes:{
            'id':'Projection_CollectionViewSVG',
            'width': '100%',
            'height': '100%',
        },

        initialize: function(){
            var self = this;
            var t_defaults = {
                width: null,
                height: null,
            };
            _.extend(this, t_defaults);
        },

        onShow: function(){
            var self = this;
            self.width = self.$el.width();
            self.height = self.$el.height();
                        var t_layout = {
                           width: this.width,
                         height: this.height,
                      };
                      _.extend(Config.get("childviewLayout"), t_layout);
            self.showChildView('Projection_CollectionView', new Projection_CollectionView({collection: Datacenter.Projection_Collection}));
        },

    }, Base));
});