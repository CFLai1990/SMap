/**
 * Created by Chufan Lai on 2015/12/20.
 * Layout for view map
 */

define([
	'require',
	'marionette',
	'underscore',
	'jquery',
	'backbone',
	'd3',
	'Base',
	'ViewmapCollectionView',
	'datacenter',
	'text!templates/viewmaplayout.tpl'
], function(require, Mn, _, $, Backbone, d3, Base, ViewmapCollectionView, Datacenter, Tpl){
	'use strict';
	return Mn.LayoutView.extend(_.extend({

		tagName:'svg',

		template: _.template(Tpl),

		regions:{
			'ViewmapCollectionView':'#ViewmapCollectionView',
		},

		attributes:{
			'id':'ViewmapViewSVG',
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
		              _.extend(Config.get("viewmapLayout"), t_layout);
			self.showChildView('ViewmapCollectionView', new ViewmapCollectionView({collection: Datacenter.viewmapcollection}));
		},
	}, Base));
});