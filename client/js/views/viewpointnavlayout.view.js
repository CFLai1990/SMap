/**
 * Created by Chufan Lai on 2016/02/25.
 * Layout for focuses
 */

define([
	'require',
	'marionette',
	'underscore',
	'jquery',
	'backbone',
	'd3',
	'Base',
	'ViewfocusCollectionView',
	'datacenter',
	'text!templates/viewcollectionviewnav.tpl'
], function(require, Mn, _, $, Backbone, d3, Base, ViewfocusCollectionView, Datacenter, Tpl){
	'use strict';
	return Mn.LayoutView.extend(_.extend({

		tagName:'div',

		template: _.template(Tpl),

		regions:{
			'ViewcollectionViewNav':'#ViewcollectionViewNav',
		},

		attributes:{
			'id':'ViewcollectionViewNavBar',
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
		              _.extend(Config.get("viewpointsnavLayout"), t_layout);
		},
	}, Base));
});