define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'datacenter',
    'config',
    'Base',
    'SubMap_ModelView',
    'basicFunctions',
    'perfectScrollbar',
    'SubGlyph',
    ], function(require, Mn, _, $, Backbone, Datacenter, Config, Base, SubMap_ModelView, loadBasic, pfScrollBar, Subglyph) {
        'use strict';

        var SubList_CollectionView = Mn.CollectionView.extend(_.extend({

            tagName: 'div',

            attributes: {
                "id":"SubList_Old",
            },

            childView: SubMap_ModelView,

            childEvents: {
            },

            childViewOptions: {
                layout: null,
            },

            init: function(v_options){
                let t_parent = this.$el.parent(),
                    t_filtStats = ["none", "on", "off"];
                t_filtStats.next = function(v_i){ return (v_i+1)%this.length; }
                let t_defaults = {
                        newData: true,
                        overallList: null,
                        overallColors: null,
                        currentList: null,
                        currentColors: null,
                        selections: null,
                        codes: null,
                        codeLength: null,
                        size: [t_parent.width(), t_parent.height()],
                        layout: {
                            histHeight: 0.08,
                            marginHeight: 0.02,
                            marginWidth: 0.08,
                            filterWidth: 0.88,
                            filterMarginWidth: 0.06,
                            filterHeight: 0.12,
                            listWidth: 0.84,
                            listHeight: 0.80,
                            listMargin: 0.01,
                            listMarginLimits: [0, 0],
                        },
                        itemHeightRatio: 0.07,
                        itemHeightLimits: [5, 13],
                        itemWidthRatio: 0.84,
                        filter: {
                            states: t_filtStats,
                            currentStates: null,
                            locked: null,
                            timer: null,
                            waitTime: 0,
                            glyphToMargin: 20,
                        },
                        animation: {
                            short: 400,
                            long: 800,
                        },
                        filterers: {
                            highlight: BasicView.filter({
                                container: this.d3el,
                                overallSelector: ".SubListItem",
                                overallFilterFunc: function(v_d){return !d3.select(this).classed("locked");},
                                subSelector: "svg",
                                controlAttr: "opacity",
                                static: {
                                    attrs: ["class"],
                                    match: ["chosen"],
                                    miss: [null],
                                    normal: [false],
                                },
                                animation: {
                                    attr: "opacity",
                                    match: 1.0,
                                    miss: 0.4,
                                    duration: 400, 
                                },
                            }),
                            filterDims: BasicView.filter({
                                container: this.d3el,
                                overallSelector: ".SubListItem",
                                controlAttr: "slider",
                                animation: () => {},
                            }),
                        },
                        dimIndeces: null,
                        dataIndeces: null,
                    };
                v_options = v_options || {};
                _.extend(this, t_defaults);
                _.extend(this, v_options);
            },

            initialize: function () {
                this.init();
                this.bindAll();
            },

            onShow: function(){
                if(!this.ready){
                    let t_parent = this.$el.parent()[0];
                    d3.selectAll("#SubList_Old")
                    .remove();
                    d3.select(t_parent)
                    .style("width", "100%")
                    .style("height", "100%")
                    .append("div")
                    .attr("id", "SubList_View")
                    .style("width", "100%")
                    .style("height", "100%");
                    this.$el = $("#SubList_View");
                    this.d3el = d3.select(this.$el[0]);
                    this.setElement(this.$el);
                    this.ready = true;
                }
            },

            initList: function(v_cls){
                let t_codeLength = this.codeLength = this.codes[0].length;
                class listItems{
                    constructor(v_id, v_codes, v_col){
                        this.id = (v_id == null?-1:v_id);
                        this.code = (v_codes == null?(new Array(t_codeLength).fill(0)):v_codes);
                        this.color = null;
                        this.array = null;
                        if(v_col != null){
                            let t_col = new Array();
                            for(let i = 0; i < v_col.length; i++){
                                t_col.push(~~(v_col[i] * 255));
                            }
                            this.color = "rgb(" + t_col + ")";
                        }
                    };
                    static higherThan(v_item1, v_item2, v_supernode){
                        let t_thisCode = v_item1.code, t_thatCode = v_item2.code, t_higher;
                        if(v_supernode){
                            for(let i = 0; i < t_thisCode.length; i++){
                                if(t_thisCode[i] != t_thatCode[i]){
                                    t_higher = (t_thisCode[i] > t_thatCode[i]);
                                    break;
                                }
                            }
                        }else{
                            let t_thisLength = eval(t_thisCode.join("+")),
                                t_thatLength = eval(t_thatCode.join("+"));
                            if(t_thisLength != t_thatLength){
                                t_higher = (t_thisLength < t_thatLength);
                            }else{
                                for(let i = 0; i < t_thisCode.length; i++){
                                    if(t_thisCode[i] != t_thatCode[i]){
                                        t_higher = (t_thisCode[i] > t_thatCode[i]);
                                        break;
                                    }
                                }
                            }
                        }
                        return t_higher;
                    };
                    addup(v_item){
                        let t_thisCode = this.code, t_thatCode = v_item.code;
                        for(let i = 0; i < t_thisCode.length; i++){
                            t_thisCode[i] += t_thatCode[i];
                        }
                    };
                };
                let t_subTreeFunc = (v_subNodes, v_treePath) => {
                        let t_level_list = new Array(), t_superLeaf = new listItems(),
                            t_leavesArray = new Array();
                        for(let i = 0; i < v_subNodes.length; i++){
                            t_level_list.push(v_subNodes[i].supernode);
                            t_superLeaf.addup(v_subNodes[i].supernode);
                        }
                        t_level_list.sort((v_a, v_b) => {return listItems.higherThan(v_a, v_b);});
                        for(let i = 0; i < t_level_list.length; i++){
                            t_leavesArray.push(...t_level_list[i].array);
                        }
                        t_superLeaf.array = t_leavesArray;
                        return t_superLeaf;
                    },
                    t_leavesFunc = (v_leaves, v_onlyLeaves, v_treePath) => {
                        let t_leaves = new Array(), t_superLeaf = new listItems();
                        for(let i = 0; i < v_leaves.length; i++){
                            let t_ind = v_leaves[i],
                                t_newLeaf = new listItems(t_ind, this.codes[t_ind], this.currentColors[t_ind]);
                            t_leaves.push(t_newLeaf);
                            t_superLeaf.addup(t_newLeaf);
                        }
                        t_leaves.sort((v_a, v_b) => {return listItems.higherThan(v_b, v_a);});
                        t_superLeaf.array = t_leaves;
                        return {                            
                            supernode: t_superLeaf,
                            leafnode: v_leaves,
                        };
                    };
                let t_listTree = Basic.traverseTree(v_cls, t_subTreeFunc, t_leavesFunc);
                return t_listTree.supernode;
            },

            updateParameters: function(v_data){
                let t_changed = v_data.mapChanged;
                this.codes = v_data.codes;
                if(this.newData){
                    this.currentColors = this.overallColors = v_data.colors;
                    this.currentList = this.overallList = this.initList(v_data.clusters);
                }else{
                    if(t_changed){
                        this.currentColors = v_data.colors;
                        this.currentList = this.initList(v_data.clusters);
                    }else{
                        this.currentColors = this.overallColors;
                        this.currentList = this.overallList;
                    }
                }
                this.sellections = v_data.selections;
                this.dimNames = v_data.dimensions;
                this.dimIndeces = v_data.dimIndeces;
                this.dataIndeces = v_data.dataIndeces;
                this.showList();
            },

            showList: function(v_cls){
                if(this.newData){
                    this.clearCanvas();
                }else{
                    this.transCanvas();
                }
                this.pipeline();
                this.newData = false;
            },

            bindAll: function(){
                this.listenTo(this.collection, "SubListCollection__UpdateData", this.clearAll);
                this.listenTo(Datacenter, "SubMapCollectionView__UpdateMap", this.updateParameters);
                this.listenTo(Datacenter, "SubMapCollectionView__Filtering", this.updateFiltering);
                this.listenTo(Datacenter, "SubMapCollectionView__Choose", this.updateHighlighting);
            },

            pipeline: function(){
                this.showHistograms();
                this.showFiltering();
                this.showItems();
            },

            showMargin: function(){
                this.d3el.append("div")
                .attr("class", "margin")
                .style("width", "100%")
                .style("height", this.layout.marginHeight * 100 + "%");
            },

            showHistograms: function(){
                if(this.newData){
                    let t_this = this.d3el;
                    t_this.append("div")
                    .attr("class", "SubListHistogram")
                    .style("width", "100%")
                    .style("height", this.layout.histHeight * 100 + "%")
                    .style("margin-bottom", this.layout.marginHeight * 100 + "%");
                }
            },

            showFiltering: function(){
                let t_this = this,
                    t_stateArr = this.filter.states,
                    t_handleFilter = (v_dimStateIDs) => {
                        clearTimeout(this.filter.timer);
                        this.filter.timer = setTimeout(() => {
                            let t_dInds = this.dimIndeces,
                                t_dStates = new Array(this.codeLength).fill(-1),
                                t_returnStates = new Array(v_dimStateIDs.length),
                                t_needToFilter = false;
                            for(let i = 0; i < t_dInds.length; i++){
                                let t_ind = t_dInds[i],
                                    t_stateID = v_dimStateIDs[t_ind],
                                    t_state;
                                switch(t_stateID){
                                    case 0:
                                        t_state = -1;
                                    break;
                                    case 1:
                                        t_state = 1;
                                        t_needToFilter = true;
                                    break;
                                    case 2:
                                        t_state = 0;
                                        t_needToFilter = true;
                                    break;
                                }
                                t_dStates[t_ind] = t_state;
                                t_returnStates[i] = t_state;
                            }
                            t_returnStates.needed = t_needToFilter;
                            this.filter.currentStates = t_dStates;
                            this.collection
                            .trigger("Transmission", {
                                type: "trans",
                                message: "SubListCollectionView__Filtering",
                                data: t_returnStates,
                            });
                        }, this.filter.waitTime);
                    };
                if(this.newData){
                    let t_g = this.d3el.append("div")
                        .attr("class", "SubListFilters")
                        .style("width", this.layout.filterWidth * 100 + "%")
                        .style("height", this.layout.filterHeight * 100 + "%")
                        .style("margin-left", this.layout.filterMarginWidth * 100 + "%")
                        .style("margin-bottom", this.layout.marginHeight * 100 + "%"),
                        t_width = this.size[0] * this.layout.filterWidth,
                        t_height = this.size[1] * this.layout.filterHeight,
                        t_dimLength = this.dimNames.length,
                        t_placement = BasicView.placeEvenly([t_width, t_height], this.filter.glyphToMargin, t_dimLength),
                        t_r = t_placement.glyphSize / 2,
                        t_filterDims = new Array(t_dimLength).fill(0);
                    let t_buttong = t_g.append("svg")
                        .attr("width", t_width)
                        .attr("height", t_height)
                        .selectAll(".SubListDims")
                        .data(this.dimNames)
                        .enter()
                        .append("g")
                        .attr("class", "SubListDims none")
                        .attr("dimID", (v_name, v_i) => {
                            return v_i;
                        })
                        .attr("dimName", (v_name) => {
                            return v_name;
                        })
                        .attr("stateID", 0)
                        .attr("transform", (v_name, v_i) => {
                            return "translate(" + t_placement.glyphs[v_i] + ")"
                        });
                    let t_onClick = function(v_stateID){
                        return function(v_name, v_i){
                            let t_parent = d3.select($(this).parent()[0]);
                            if(t_parent.classed("locked")){
                                return;
                            }
                            let t_d3 = d3.select(this), t_active = t_d3.classed("active"), t_stateID = 0;
                            if(t_active){
                                t_d3.classed("active", false);
                                t_parent.attr("stateID", 0);
                                t_parent.select(".filterBtnFramework").classed("active", false);
                                t_parent.select(".SubListDimLock").classed("active", false);
                            }else{
                                t_parent.selectAll(".active").classed("active", false);
                                t_d3.classed("active", true);
                                t_parent.attr("stateID", v_stateID);
                                t_parent.select(".filterBtnFramework").classed("active", true);
                                t_parent.select(".SubListDimLock").classed("active", true);
                                t_stateID = v_stateID;
                            }
                            t_filterDims[v_i] = t_stateID;
                            t_handleFilter(t_filterDims);
                        };
                    };
                    let t_lockText = $(".hiddenIcon #Lock").get(0).innerHTML,
                        t_unlockText = $(".hiddenIcon #LockOpen").get(0).innerHTML;
                    t_buttong
                    .append("rect")
                    .attr("class", "filterBtnFramework")
                    .attr("x", t_r * 0.2)
                    .attr("y", t_r * 0.5)
                    .attr("rx", t_r * 0.4)
                    .attr("ry", t_r * 0.4)
                    .attr("width", t_r * 1.8)
                    .attr("height", t_r * 1);
                    t_buttong
                    .append("circle")
                    .attr("class", "filterBtn on")
                    .attr("cx", t_r * 0.65)
                    .attr("cy", t_r)
                    .attr("r", t_r * 0.35)
                    .on("click", t_onClick(1));
                    t_buttong
                    .append("circle")
                    .attr("class", "filterBtn off")
                    .attr("cx", t_r * 1.55)
                    .attr("cy", t_r)
                    .attr("r", t_r * 0.35)
                    .on("click", t_onClick(2));
                    t_buttong
                    .append("text")
                    .attr("class", "iconFontello SubListDimLock unlock")
                    .attr("x", t_r * 0.2)
                    .attr("y", t_r * 0.15)
                    .text(t_unlockText)
                    .on("click", function(){
                        let t_d3 = d3.select(this), t_unlock = t_d3.classed("unlock");
                        if(!t_d3.classed("active")){
                            return;
                        }
                        t_d3.text(t_unlock?t_lockText:t_unlockText);
                        t_d3.classed("unlock", !t_unlock);
                        d3.select($(this).parent()[0]).classed("locked", t_unlock);
                        t_this.collection
                        .trigger("Transmission", {
                            type: "trans",
                            message: "SubListCollectionView__Locking",
                            data: t_this.filter.currentStates,
                        });
                    });
                }
            },

            updateHighlighting: function(v_options){
                let t_filterer = this.filterers.highlight,
                    t_attr = v_options.attr,
                    t_highlightIDs = v_options.IDs,
                    t_informOthers = v_options.inform,
                    t_result;
                if(!t_filterer.ready){
                    t_filterer.init();
                }
                if(t_highlightIDs != null && t_highlightIDs.length > 0){
                    t_result = t_filterer.filter("highlighting", t_attr, t_highlightIDs);
                }else{
                    t_result = t_filterer.restore("highlighting");
                }
                if(t_informOthers){                  
                    this.collection
                    .trigger("Transmission", {
                        type: "trans",
                        message: "SubListCollectionView__Highlight",
                        data: t_highlightIDs,
                    });
                }
            },

            updatePinning: function(v_options){
                let t_filterer = this.filterers.highlight,
                    t_attr = v_options.attr,
                    t_pinIDs = v_options.IDs,
                    t_informOthers = v_options.inform,
                    t_result;
                if(!t_filterer.ready){
                    t_filterer.init();
                }
                if(t_pinIDs != null && t_pinIDs.length > 0){
                    t_result = t_filterer.pick("pinning", t_attr, t_pinIDs);
                }else{
                    t_result = t_filterer.restore("pinning");
                }
                if(t_informOthers){                            
                    this.collection
                    .trigger("Transmission", {
                        type: "trans",
                        message: "SubListCollectionView__Pin",
                        data: t_pinIDs,
                    });
                }
            },

            updateFiltering: function(v_filterIDs){
                let t_filterer = this.filterers.filterDims;
                if(v_filterIDs == null){
                    let t_animate = function(v_d3Selection, v_fit){
                        let t_objs = v_d3Selection[0];
                        if(t_objs.length > 0){
                            if(v_fit){
                                $(v_d3Selection[0]).slideDown();
                            }else{
                                $(v_d3Selection[0]).slideUp();
                            }
                        }
                    };
                    t_filterer.animation = t_animate;
                    t_filterer.init();
                }else{
                    let t_IDBook = new Array();
                    for(let i = 0; i < v_filterIDs.length; i++){
                        t_IDBook.push(v_filterIDs[i] + "");
                    }
                    t_filterer.filterChange("sliding", "index", t_IDBook);
                }
            },

            showItems: function(){
                let t_allLength = this.currentList.array.length,
                    t_layout = this.layout,
                    t_itemWidth = this.size[0] * this.itemWidthRatio,
                    t_itemHeight = this.size[1] * this.itemHeightRatio,
                    t_marginHeight = this.size[1] * t_layout.listMargin,
                    t_this = this;
                if(this.newData){
                    let t_list = this.d3el.append("div")
                        .attr("class", "SubListItems")
                        .style("width", "100%")
                        .style("height", this.layout.listHeight * 100 + "%"),
                        t_glyphType = Config.get("listType"),
                        t_innerWidthRatio = 0.9,
                        t_innerHeightRatio = 0.9,
                        t_innerMarginRatio = 0.05,
                        t_itemGlyph;
                    t_itemHeight = Basic.trimNumber(t_itemHeight, this.itemHeightLimits);
                    t_marginHeight = Basic.trimNumber(t_marginHeight, t_layout.listMarginLimits);
                    t_itemGlyph = SubGlyph.getRectGlyph(this.codeLength, [t_itemWidth * t_innerWidthRatio, t_itemHeight * t_innerHeightRatio], "SubListItemGlyph", t_glyphType);
                    $(".SubListItems").perfectScrollbar({wheelSpeed: 0.5});
                    let t_parentDiv = t_list.selectAll(".SubListItem")
                        .data(this.currentList.array)
                        .enter()
                        .append("div")
                        .attr("class", "SubListItem")
                        .attr("index", (v_listItem, v_i) => {return v_listItem.id;})
                        .style("line-height", t_itemHeight + "px")
                        .style("margin-bottom", t_marginHeight + "px")
                        .each(function(v_listItem, v_i){
                            let t_code = v_listItem.code;
                            let t_svg = d3.select(this)
                                .append("svg")
                                .style("left", t_layout.marginWidth * 100 + "%")
                                .attr("width", t_itemWidth + "px")
                                .attr("height", t_itemHeight + "px");
                            t_svg.append("g")
                            .attr("transform", "translate(" + [t_itemWidth * t_innerMarginRatio, 0] + ")")
                            .append("rect")
                            .attr("x", 1)
                            .attr("y", 1)
                            // .attr("rx", 10)
                            // .attr("ry", 10)
                            .attr("width", t_itemWidth * t_innerWidthRatio + "px")
                            .attr("height", t_itemHeight * t_innerHeightRatio + "px")
                            .attr("fill", (v_listItem, v_i) => {
                                return v_listItem.color;
                            })
                            .attr("class", "SubListItemBackground");
                            let t_g = t_svg.append("g")
                                .attr("transform", "translate(" + [t_itemWidth * t_innerMarginRatio, t_itemHeight * t_innerMarginRatio] + ")")
                            t_itemGlyph.show(t_g, t_code);
                            t_svg.append("g")
                            .attr("transform", "translate(" + [t_itemWidth * t_innerMarginRatio, 0] + ")")
                            .append("rect")
                            .attr("x", 1)
                            .attr("y", 1)
                            // .attr("rx", 10)
                            // .attr("ry", 10)
                            .attr("width", t_itemWidth * t_innerWidthRatio + "px")
                            .attr("height", t_itemHeight * t_innerHeightRatio + "px")
                            .attr("class", "SubListItemForeground")
                            .on("mouseover", () => {
                                if(d3.select(this).classed("pinned")){
                                    return;
                                }
                                t_this.updateHighlighting({
                                    attr: "index",
                                    IDs: [v_listItem.id + ""],
                                    inform: true,
                                });
                            })
                            .on("mouseout", () => {
                                if(d3.select(this).classed("pinned")){
                                    return;
                                }
                                t_this.updateHighlighting({
                                    attr: "index",
                                    inform: true,
                                });
                            })
                            .on("click", function(){
                                let t_d3 = d3.select(this), t_chosen = t_d3.classed("pinned");
                                if(!t_chosen){
                                    t_d3.classed("pinned", true);
                                    t_this.updatePinning({
                                        attr: "index",
                                        IDs: [v_listItem.id + ""],
                                        inform: true,
                                    });
                                }else{
                                    t_this.updatePinning({
                                        attr: "index",
                                        inform: true,
                                    });
                                    t_d3.classed("pinned", false);
                                }
                            });
                        });
                    this.updateFiltering();
                }else{
                    let t_list = this.currentList.array,
                        t_length = t_list.length,
                        t_indeces = this.dataIndeces,
                        t_nameBook = new Map(),
                        t_colors = this.currentColors;
                    if(t_indeces == null || t_indeces.length == 0){
                        for(let i = 0; i < t_length; i++){
                            t_nameBook.set(i + "", i + "");
                        }
                    }else{
                        for(let i = 0; i < t_length; i++){
                            t_nameBook.set(t_indeces[i] + "", i + "");
                        }
                    }
                    this.d3el.selectAll(".SubListItem")
                    .filter(function(){
                        let t_index = d3.select(this).attr("index");
                        if(!t_nameBook.has(t_index)){
                            d3.select(this).classed("locked", true);
                            $(this).slideUp();
                        }else{
                            let t_newID = t_nameBook.get(t_index),
                                t_listItem = t_list.filter((v_item) => {return ((v_item.id + "") == t_newID);})[0];
                            d3.select(this).classed("locked", false)
                            .selectAll(".SubListItemBackground")
                            .interrupt()
                            .transition()
                            .duration(t_this.animation.long)
                            .ease("linear")
                            .attr("fill", t_listItem.color);
                            $(this).slideDown();
                        }
                    });
                }
            },

            clearAll: function(){
                this.init();
            },

            clearCanvas: function(){
                let t_remove = (v_selector) => {this.d3el.selectAll(v_selector).remove();}
                t_remove(".SubListHistogram");
                t_remove(".SubListFilters");
                t_remove(".SubListItems");
            },

            transCanvas: function(){

            },
        },Base));

    return SubList_CollectionView;
});
