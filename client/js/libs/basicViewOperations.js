(function () {
    'use strict';
    let $ = require("jquery");
    String.prototype.visualSize = function(v_fontSize = 12)
    {
        let ruler = document.getElementById("ruler");
        if(ruler == null){
            let t_ruler = document.createElement('span');
            t_ruler.id = "ruler";
            t_ruler.setAttribute("style", "font-size: " + v_fontSize + "px;visibility: hidden;");
            document.body.append(t_ruler);
            ruler = document.getElementById("ruler");
        }else{
            ruler.setAttribute("style", "font-size: " + v_fontSize + "px;visibility: hidden;");
        }
        ruler.textContent = this;
        return [ruler.offsetWidth, ruler.offsetHeight];
    };
    class PDFilter{// one PDFilter only controls one type of attribute, but allows multiple cross filters
        constructor(v_filterSetting){
            this.container = v_filterSetting.container;
            this.overallSelector = v_filterSetting.overallSelector;
            this.overallKey = v_filterSetting.overallKey;
            let t_ovlFiltFunc = v_filterSetting.overallFilterFunc;
            this.overallFilterFunc = (t_ovlFiltFunc == null)?((v_d) => {
                return true;
            }):t_ovlFiltFunc;
            this.subSelector = v_filterSetting.subSelector;
            this.controlAttr = v_filterSetting.controlAttr;
            this.static = v_filterSetting.static;
            this.animation = v_filterSetting.animation;
            if(typeof(this.animation) == "object"){
                let t_duration = this.animation.duration;
                this.animation.duration = (t_duration == null)?t_duration:400;
            }
            this.filterers = new Array();
            this.filterID = 0;
            this.ready = false;
        };
        init(){
            this.ready = true;
            let t_this = this, t_animation = this.animation,
                t_ovlFilter = this.overallFilterFunc,
                t_selection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc);
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            if(typeof(t_animation) == "function"){
                t_animation(t_selection, true);
            }else{
                if(typeof(t_animation.match) != "function"){
                    t_animation.match = () => {return t_animation.match;};
                }
                if(typeof(t_animation.miss) != "function"){
                    t_animation.miss = () => {return t_animation.miss;};
                }
                t_selection.attr(t_animation.attr, t_animation.match());
            }
            this.filterers.filters = new Array();
            this.filterers.pickers = new Array();
            this.filterers.reducers = new Array();// reducers && ((filters && filters) || (pickers || pickers))
            this.filterers.otherFilters = new Array();
            this.filterers.otherPickers = new Array();
            this.filterers.otherReducers = new Array();
            this.filterers.add = function(v_id, v_attr, v_filterFunc, v_type = "filter"){
                let t_animation = t_this.animation, t_filterSign = "PDfiltered_" + v_id + "_" + t_this.filterID,
                    t_selection = t_this.container.selectAll(t_this.overallSelector)
                    .filter(t_this.overallFilterFunc)
                    .classed(t_filterSign, true);
                this.push({
                    id: v_id,
                    attr: v_attr,
                    sign: t_filterSign,
                    func: v_filterFunc,
                    type: v_type,
                });
                switch(v_type){
                    case "reduce":
                        this.reducers.push(t_filterSign);
                    break;
                    case "filter":
                        this.filters.push(t_filterSign);
                    break;
                    case "pick":
                        this.pickers.push(t_filterSign);
                    break;
                }
                t_this.filterID++;
                return t_this.filterID - 1;
            };
            this.filterers.findID = function(v_id){
                return this.findIndex((v_filterer) => {return v_filterer.id == v_id});
            };
            this.filterers.fitFilters = function(v_obj, v_sign, v_selfOnly = false){
                let t_allFilters = v_selfOnly?(this.filters):[...this.filters, ...this.otherFilters], t_fit = true;
                for(let i = 0; i < t_allFilters.length; i++){
                    let t_sign_i = t_allFilters[i];
                    if(t_sign_i == v_sign){
                        continue;
                    }else{
                        if(!d3.select(v_obj).classed(t_sign_i)){
                            t_fit = false;
                            break;
                        }
                    }
                }
                if(t_fit){
                    t_fit = this.fitReducers(v_obj, v_sign);
                }
                return t_fit;
            };
            this.filterers.fitPickers = function(v_obj, v_sign, v_selfOnly = false){
                let t_allPickers = v_selfOnly?(this.pickers):[...this.pickers, ...this.otherPickers], t_fit = false;
                for(let i = 0; i < t_allPickers.length; i++){
                    let t_sign_i = t_allPickers[i];
                    if(v_sign != null && v_sign == t_sign_i){
                        continue;
                    }
                    if(d3.select(v_obj).classed(t_sign_i)){
                        t_fit = true;
                        break;
                    }
                }
                if(t_fit){
                    let t_newFit = this.fitReducers(v_obj, v_sign);
                    if(t_fit != t_newFit)
                    t_fit = t_newFit;
                }
                return t_fit;
            };
            this.filterers.fitReducers = function(v_obj, v_sign, v_selfOnly = false){
                let t_reducers = v_selfOnly?(this.reducers):[...this.reducers, ...this.otherReducers], t_fit = true;
                if(t_reducers.length > 0){
                    for(let i = 0; i < t_reducers.length; i++){
                        let t_sign_i = t_reducers[i];
                        if(t_sign_i == v_sign){
                            continue;
                        }else{
                            if(!d3.select(v_obj).classed(t_sign_i)){
                                t_fit = false;
                                break;
                            }
                        }
                    }
                }
                return t_fit;
            };
            this.filterers.getPickers = function(v_selection, v_sign){
                let t_filterers = this,
                    t_pickSelection = t_this.container
                    .selectAll(t_this.overallSelector)
                    .filter(t_this.overallFilterFunc)
                    .filter(function(){
                        return t_filterers.fitPickers(this, v_sign);
                    }),
                    t_objs = t_pickSelection[0];
                let t_keys = new Set(), t_keyName = t_this.overallKey;
                v_selection.each(function(){
                    t_keys.add($(this).attr(t_keyName));
                });
                for(let i = 0; i < t_objs.length; i++){
                    let t_key = $(t_objs[i]).attr(t_keyName);
                    if(!t_keys.has(t_key)){
                        v_selection[0].push(t_objs[i]);
                    }
                }
            };
            this.filterers.restoreOthers = function(v_sign){
                let t_allSigns = this.filters, t_objs = t_this.container.selectAll(t_this.overallSelector)
                    .filter(t_this.overallFilterFunc).classed(v_sign, true);
                for(let i = 0; i < t_allSigns.length; i++){
                    let t_sign = t_allSigns[i]
                    if(t_sign == v_sign){
                        continue;
                    }
                    t_objs = t_objs.filter(function(){
                        return d3.select(this).classed(t_sign);
                    });
                };
                return t_objs;
            };
        };
        setStatic(v_selection, v_match, v_selLength){
            let t_static = this.static,
                t_filterers = this.filterers,
                t_allSelection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc),
                t_isNormal = (t_allSelection[0].length == v_selLength),
                t_selection = v_selection;
            if(t_static != null && !t_selection.empty()){
                let t_staticAttrs = t_static.attrs, t_matches = t_static.match, t_misses = t_static.miss, t_normals = t_static.normal;
                for(let i = 0; i < t_staticAttrs.length; i++){
                    let t_attr = t_staticAttrs[i], t_noSpecial = (t_normals == null?true:t_normals[i]);
                    if(t_attr == "class"){
                        let t_match = t_noSpecial?v_match:(t_isNormal?false:v_match);
                        if(t_matches[i] == "chosen")
                        if(t_matches[i] != null){
                            t_selection.classed(t_matches[i], t_match);
                        }
                        if(t_misses[i] != null){
                            t_selection.classed(t_misses[i], !t_match);
                        }
                    }else{
                        let t_normalValue = (v_match?t_matches[i]:t_misses[i]),
                            t_specialValue = (v_match?t_misses[i]:t_matches[i]),
                            t_value = t_noSpecial?t_normalValue:(t_isNormal?t_normalValue:t_specialValue);
                        t_selection.attr(t_attr, t_value);
                    }
                }
            }
        };
        setAnimation(v_selection, v_match){
            let t_animation = this.animation;
            if(typeof(t_animation) == "function"){
                t_animation(v_selection, v_match);
            }else{
                v_selection
                .interrupt()
                .transition()
                .duration(t_animation.duration)
                .attr(t_animation.attr, v_match?t_animation.match():t_animation.miss());
            }
        };
        filterChange(v_id, v_attr, v_values, v_filterFunc, v_reduce = false){
            let t_filterID = this.filterers.findID(v_id);
            if(t_filterID == -1){
                t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, v_reduce?"reduce":"filter");
            }
            let t_filterers = this.filterers,
                t_filterer = t_filterers[t_filterID],
                t_sign = t_filterer.sign,
                t_oldSign = t_sign + "_old",
                t_animation = this.animation,
                t_conditions = new Set(v_values),
                t_filterFunc = t_filterer.func,
                t_fAttr = t_filterer.attr,
                t_oldSelection = this.container.selectAll(this.overallSelector + "." + t_sign)
                .filter(this.overallFilterFunc)
                .classed(t_oldSign, true)
                .classed(t_sign, false),
                t_newSelection = this.container.selectAll(this.overallSelector)
                .filter(this.overallFilterFunc)
                .filter(function(){
                    let t_attr = d3.select(this).attr(t_fAttr);
                    if(t_filterFunc == null){
                        return t_conditions.has(t_attr);
                    }else{
                        return t_filterFunc(t_attr);
                    }
                })
                .filter(function(){
                    return t_filterers.fitFilters(this, t_sign);
                })
                .classed(t_sign, true);
            t_filterers.getPickers(t_newSelection);
            let t_falseToTrue = t_newSelection.filter(function(){
                    return !d3.select(this).classed(t_oldSign);
                }),
                t_trueToFalse = t_oldSelection.filter(function(){
                    return !d3.select(this).classed(t_sign);
                });
            this.container.selectAll("." + t_oldSign)
            .classed(t_oldSign, false);
            this.setStatic(t_falseToTrue, true, t_falseToTrue[0].length);
            this.setStatic(t_trueToFalse, false, t_trueToFalse[0].length);
            this.setAnimation(t_falseToTrue, true);
            this.setAnimation(t_trueToFalse, false);
            return t_newSelection;
        };
        pick(v_id, v_attr, v_values, v_filterFunc){
            let t_filterID = this.filterers.findID(v_id), t_return;
            if(t_filterID == -1){
                t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, "pick");
            }
            let t_filterers = this.filterers,
                t_filterer = t_filterers[t_filterID],
                t_sign = t_filterer.sign,
                t_conditions = new Set(v_values),
                t_filterFunc = t_filterer.func,
                t_fAttr = t_filterer.attr;
            if(v_filterFunc != null){
                t_filterer.func = t_filterFunc = v_filterFunc;
            }
            this.restore(v_id, false);
            let t_selection = this.container.selectAll(this.overallSelector)
                .filter(this.overallFilterFunc)
                .filter(function(){
                    let t_attr;
                    if(t_fAttr == "data"){
                        t_attr = d3.select(this).data();
                    }else{
                        t_attr = d3.select(this).attr(t_fAttr);
                    }
                    if(t_filterFunc == null){
                        return t_conditions.has(t_attr);
                    }else{
                        return t_filterFunc(t_attr);
                    }
                })
                .filter(function(){
                    return t_filterers.fitReducers(this);
                })
                .classed(t_sign, true);
            t_filterers.getPickers(t_selection, t_sign);
            t_return = t_selection;
            let t_eleNum = t_selection[0].length;
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            this.setStatic(t_selection, true, t_eleNum);
            this.setAnimation(t_selection, true);
            return t_return;
        };
        filter(v_id, v_attr, v_values, v_filterFunc, v_reduce = false){
            let t_filterID = this.filterers.findID(v_id), t_return;
            if(t_filterID == -1){
                t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, v_reduce?"reduce":"filter");
            }
            let t_filterers = this.filterers,
                t_filterer = t_filterers[t_filterID],
                t_sign = t_filterer.sign,
                t_conditions = new Set(v_values),
                t_filterFunc = t_filterer.func,
                t_fAttr = t_filterer.attr;
            if(v_filterFunc != null){
                t_filterer.func = t_filterFunc = v_filterFunc;
            }
            this.restore(v_id, false);
            let t_selection = this.container.selectAll(this.overallSelector)
                .filter(this.overallFilterFunc)
                .filter(function(){
                    let t_attr;
                    if(t_fAttr == "data"){
                        t_attr = d3.select(this).data();
                    }else{
                        t_attr = d3.select(this).attr(t_fAttr);
                    }
                    if(t_filterFunc == null){
                        return t_conditions.has(t_attr);
                    }else{
                        let t_fit = t_filterFunc(t_attr);
                        return t_fit;
                    }
                })
                .filter(function(){
                    return t_filterers.fitFilters(this, t_sign);
                })
                .classed(t_sign, true);
            t_filterers.getPickers(t_selection);
            t_return = t_selection;
            let t_eleNum = t_selection[0].length;
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            this.setStatic(t_selection, true, t_eleNum);
            this.setAnimation(t_selection, true);
            return t_return;
        };
        restore(v_id, v_direct = true){
            let t_filterer = this.filterers.find((v_ft) => {return (v_ft.id == v_id);});
                if(t_filterer == null){
                    return null;
                }
            let t_sign = t_filterer.sign,
                t_isPicker = (t_filterer.type == "pick"),
                t_isReducer = (t_filterer.type == "reduce"),
                t_filterers = this.filterers, t_selection,
                t_noPickers = true,
                t_allSelection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc);
            if(!t_isPicker){
                t_selection = t_filterers.restoreOthers(t_sign).classed(t_sign, v_direct);
            }else{
                t_selection = t_allSelection.classed(t_sign, false);
            }
            if(!t_isPicker && this.filterers.pickers.length > 0){
                let t_newSelection = t_selection
                .filter(function(){
                    return !(t_filterers.fitPickers(this));
                });
                if(t_newSelection[0].length != t_selection[0].length){
                    t_noPickers = false;
                    t_selection = t_newSelection;
                }
            }
            let t_eleNum = t_selection[0].length,
                t_match = (v_direct?t_noPickers:false);
            if(t_match){
                t_selection = t_selection.filter(function(){
                    return t_filterers.fitReducers(this);
                });
            }
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            this.setStatic(t_selection, t_match, t_eleNum);
            this.setAnimation(t_selection, t_match);
            let t_return;
            if(v_direct){
                if(!t_isReducer){
                    t_return = t_allSelection.filter(function(){             
                        return t_filterers.fitPickers(this) && t_filterers.fitReducers(this);
                    });
                }else{
                    t_return = t_allSelection;
                }
            }
            return t_return;
        };
        getOther(v_type){
            let t_filterer = this.filterers, t_return;
            switch(v_type){
                case "reduce":
                    t_return = t_filterer.otherReducers;
                break;
                case "filter":
                    t_return = t_filterer.otherFilters;
                break;
                case "pick":
                    t_return = t_filterer.otherPickers;
                break;
            }
            return t_return;
        };
        get(v_type){
            let t_filterer = this.filterers, t_return;
            switch(v_type){
                case "reduce":
                    t_return = t_filterer.reducers;
                break;
                case "filter":
                    t_return = t_filterer.filters;
                break;
                case "pick":
                    t_return = t_filterer.pickers;
                break;
            }
            return t_return;
        };
        set(v_type, v_values){
            let t_filterer = this.filterers, t_array;
            switch(v_type){
                case "reduce":
                    t_array = t_filterer.otherReducers;
                break;
                case "filter":
                    t_array = t_filterer.otherFilters;
                break;
                case "pick":
                    t_array = t_filterer.otherPickers;
                break;
            }
            for(let i = 0; i < v_values.length; i++){
                let t_value = v_values[i];
                if(t_array.indexOf(t_value) < 0){
                    t_array.push(t_value);
                }
            }
        };
    };

	window['BasicView'] = {
        hideTimers: new Map(),

        showOnTop: function(v_target, v_container){
            $(v_container).append($(v_target));
        },

        hide: function(v_id, v_selection, v_duration = 400, v_hide = true, v_delete = false){
            if(v_hide){
                v_selection
                .interrupt()
                .transition()
                .duration(v_duration)
                .attr("opacity", 0);
                this.hideTimers.set(v_id, setTimeout(() => {
                    v_selection.style("display", "none");
                    if(v_delete){
                        v_selection.remove();
                    }
                }, v_duration + 100));
            }else{
                let t_timers = this.hideTimers,
                    t_timer = t_timers.get(v_id);
                if(t_timer != null){
                    clearTimeout(t_timer);
                    t_timers.delete(v_id);
                }
                v_selection
                .style("display", "block")
                .interrupt()
                .transition()
                .duration(v_duration)
                .attr("opacity", 1);
            }
        },

        placeEvenly: function([v_width, v_height], v_glyphToMarginRatio, v_num, v_circle = false, v_horizon = true){
        	let [t_width, t_height] = v_horizon?([v_width, v_height]):([v_height, v_width]),
                t_maxSize = Math.max(t_width, t_height),
                t_minSize = Math.min(t_width, t_height),
        		t_marginMax = t_maxSize / (v_glyphToMarginRatio * v_num + (v_num + 1)),
        		t_glyphSize = t_marginMax * v_glyphToMarginRatio,
        		t_marginMin = v_circle?((t_minSize - t_glyphSize) / 2):(t_minSize * 0.06),
        		t_placement = new Array();
            if(v_circle && t_marginMin <= 0){
                t_glyphSize = t_minSize * 0.88;
                t_marginMax = (t_maxSize - t_glyphSize * v_num) / (v_num + 1);
                t_marginMin = t_minSize * 0.06;
            }
        	for(let i = 0; i < v_num; i++){
                let t_x = t_marginMax * (i + 1) + t_glyphSize * i,
                    t_y = t_marginMin,
                    t_pos = v_horizon?[t_x, t_y]:[t_y, t_x];
        		t_placement.push(t_pos);
        	}
        	return {
        		glyphs: t_placement,
        		glyphSize: t_glyphSize,
        		margin: [t_marginMax, t_marginMin],
                glyphToMarginRatio: t_glyphSize / t_marginMax,
        	};
        },

        filter: function(v_filterSetting){
            return new PDFilter(v_filterSetting);
        },

        colToRgb: function(v_colArr){
            let t_col = [~~(255*v_colArr[0]), ~~(255*v_colArr[1]), ~~(255*v_colArr[2])];
            return "rgb(" + t_col + ")";
        },

        getTransform: function(v_transform){
            let t_trans = v_transform,
                t_return = {
                    scale: 1.0,
                    translate: [0,0],
                    scaleFirst: true,
                };
            if(t_trans != null && t_trans != ""){
                let t_indScale = t_trans.indexOf("scale"),
                    t_indTrans = t_trans.indexOf("translate"),
                    t_translate, t_scale,
                    t_scaleFirst, t_scaleLength, t_transLength;
                t_scaleFirst = t_return.scaleFirst = (t_indScale >=0 && t_indScale > t_indTrans);
                if(t_indScale < 0){
                    t_scaleLength = 0;
                    if(t_indTrans < 0){
                        t_transLength = 0;
                    }else{
                        t_transLength = t_trans.length;
                    }
                }else{
                    if(t_indTrans < 0){
                        t_transLength = 0;
                        t_scaleLength = t_trans.length;
                    }else{
                        if(t_scaleFirst){
                            t_transLength = t_indScale;
                            t_scaleLength = t_trans.length - t_transLength;
                        }else{
                            t_scaleLength = t_transLength;
                            t_transLength = t_trans.length - t_scaleLength;
                        }
                    }
                }
                if(t_scaleLength > 0){
                    t_scale = t_trans.slice(t_indScale, t_indScale + t_scaleLength).replace("scale","").replace("(","").replace(")","");
                    t_return.scale = parseFloat(t_scale);
                }
                if(t_transLength > 0){
                    t_translate = t_trans.slice(t_indTrans, t_indScale + t_transLength).replace("translate","").replace("(","").replace(")","").split(",");
                    t_return.translate[0] = parseFloat(t_translate[0]);
                    t_return.translate[1] = parseFloat(t_translate[1]);
                }
            }
            return t_return;
        },

        transition: function(v_selection, v_attrMap, v_duration = 400){
            let t_animation = v_selection
                .interrupt()
                .transition()
                .duration(v_duration),
                t_it = v_attrMap.entries();
            while(!t_it.done){
                let t_attr = t_it.value[0],
                    t_value = t_it.value[1];
                if(typeof(t_value) == "function"){
                    t_animation = t_animation.attr(t_attr, function(v_d, v_i){
                        t_value(this, v_d, v_i);
                    });
                }else{
                    t_animation = t_animation.attr(t_attr, t_value);   
                }
            }
        },

        getFromSelection: function(v_selection, v_attr, v_attrFunc){
            if(v_selection == null || v_selection.empty()){
                return null;
            }
            let t_values = new Array();
            if(v_attr == null && v_attrFunc == null){
                return v_selection;
            }else{                
                if(v_attr != null){
                    v_selection.each(function(){
                        t_values.push($(this).attr(v_attr));
                    });
                }else{
                    if(typeof(v_attrFunc) == "function"){
                        v_selection.each(function(v_d){
                            let t_info = v_attrFunc(this, v_d);
                            t_values.push(t_info);
                        });
                    }
                }
            }
            return t_values;
        },
	};
})();