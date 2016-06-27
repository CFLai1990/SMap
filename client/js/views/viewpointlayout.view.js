/**
 * Created by Chufan Lai on 2015/12/16.
 * Layout for all viewpoints
 */

define([
	'require',
	'marionette',
	'underscore',
	'jquery',
	'backbone',
	'd3',
	'Base',
	'ViewpointCollectionView',
	'datacenter',
	'text!templates/viewpointlayout.tpl'
], function(require, Mn, _, $, Backbone, d3, Base, ViewpointCollectionView, Datacenter, Tpl){
	'use strict';
	return Mn.LayoutView.extend(_.extend({

		tagName:'svg',

		template: _.template(Tpl),

		regions:{
			'ViewpointCollectionView':'#ViewpointCollectionView',
		},

		attributes:{
			'id':'ViewcollectionViewSVG',
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
		              _.extend(Config.get("viewpointsLayout"), t_layout);
			self.showChildView('ViewpointCollectionView', new ViewpointCollectionView({collection: Datacenter.viewpointcollection}));
		},

	}, Base));
});