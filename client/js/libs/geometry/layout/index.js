define([
  './HierarchicalTiling',
  './SubmapLayout'
], function (HierarchicalTiling, SubmapLayout) {
  let Layout = {
    hierarchical: HierarchicalTiling,
    submap: SubmapLayout
  }
  return Layout
})
