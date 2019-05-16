    filterGlyphsByDims: function(container, dimCover, attr, attrFunc, extraInfo) {
        let t_filterer = this.filterer
        if (t_filterer == null || !t_filterer.ready) {
            this.initializeFilter(container)
        }
        let filterResult
        if (dimCover != null && dimCover.needed) {
            filterResult = this.filterer.filter('filterDims', 'data', null, this.filterSettings.getFilterFunc(dimCover, extraInfo), true)
        } else {
            filterResult = this.filterer.restore('filterDims')
        }
        return BasicView.getFromSelection(filterResult, attr, attrFunc)
    },