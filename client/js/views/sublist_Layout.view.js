define([
  'require',
  'marionette',
  'underscore',
  'jquery',
  'backbone',
  'd3',
  'Base',
  'SubList_CollectionView',
  'datacenter',
  'text!templates/sublist_Layout.tpl'
], function (require, Mn, _, $, Backbone, d3, Base, SubList_CollectionView, Datacenter, Tpl) {
  'use strict'
  return Mn.LayoutView.extend(_.extend({

    tagName: 'div',

    template: _.template(Tpl),

    regions: {
      'SubList_Container': '#SubList_Container'
    },

    attributes: {
      'id': 'SubList_CollectionView'
    },

    initialize: function () {
      let t_defaults = {
        width: null,
        height: null
      }
      _.extend(this, t_defaults)
    },

    onShow: function () {
      this.showChildView('SubList_Container', new SubList_CollectionView({collection: Datacenter.SubList_Collection}))
      this.$el = this.$el.children()
      this.$el.unwrap()
      this.setElement(this.$el)
    }

  }, Base))
})
