(function () {
  'use strict'
  class pandaHist {
        constructor (v_options) {
            this.container = v_options.container
            this.size = v_options.size
            this.ratio = v_options.ratio ? v_options.ratio : [0.98, 0.95]
            this.data = v_options.data ? v_options.data : []
      this.duration = v_options.duration ? v_options.duration : 400
      this.dataRange = v_options.dataRange ? v_options.dataRange : [0, d3.max(this.data)]
      this.margin = 5
      this.maxTextHeight = 8
      this.posScale = d3.scale.linear().domain(this.dataRange).range([this.size[1] - this.margin, this.maxTextHeight + this.margin])
      this.heightScale = d3.scale.linear().domain([0, this.dataRange[1] - this.dataRange[0]]).range([0, this.size[1] - this.maxTextHeight - 2 * this.margin])
            this.className = v_options.className ? v_options.className : 'pandaHistBar'
            this.barToMargin = v_options.barToMargin ? v_options.barToMargin : 8
            this.placement = BasicView.placeEvenly(this.size, this.barToMargin, this.data.length)
      this.fontSize = Math.round(v_options.fontSize ? v_options.fontSize : this.placement.glyphSize * 0.2)
            this.barWidth = this.placement.glyphSize
      this.barWidthRatio = v_options.barWidth ? v_options.barWidth : 0.6
      this.marginWidth = this.barWidth * (1 - this.barWidthRatio) * 0.5
      this.barWidth = this.barWidth * this.barWidthRatio
            this.ready = true
        };
        show () {
            let t_className = this.className,
                t_data = this.data,
                t_placement = this.placement,
                t_barWidth = this.barWidth,
      t_marginWidth = this.marginWidth,
                t_marginLeft = this.size[0] * (1 - this.ratio[0]) / 2,
                t_marginTop = this.size[1] * (1 - this.ratio[1]),
      t_posScale = this.posScale,
      t_heightScale = this.heightScale,
      t_g = this.container
                .style('overflow', 'visible')
                .append('g')
                .attr('class', t_className + 'Container')
                .attr('transform', 'translate(' + [t_marginLeft, t_marginTop] + ')')
                .selectAll('.' + t_className)
                .data(t_data)
                .enter()
                .append('g')
                .attr('class', t_className)
                .attr('transform', (v_d, v_i) => {
                  let t_pos = t_placement.glyphs[v_i]
                  return 'translate(' + [t_pos[0], 0] + ')'
                })
      let t_poses = new Array()
      t_g.append('rect')
            .attr('x', t_marginWidth)
            .attr('y', (v_d, v_i) => {
              let t_pos = t_posScale(v_d)
              t_poses[v_i] = t_pos
              return t_pos
            })
            .attr('width', t_barWidth)
            .attr('height', (v_d) => {
              return t_heightScale(v_d)
            })
      let t_texts = new Map()
      t_g.append('text')
            .attr('size', (v_d) => {
              return (v_d + '').visualSize(this.fontSize).join('_')
            })
            .attr('x', function (v_d) {
              let t_size = d3.select(this).attr('size').split('_')
              return t_marginWidth + (t_barWidth - parseFloat(t_size[0])) * 0.5
            })
            .attr('y', function (v_d, v_i) {
              let t_pos = t_poses[v_i],
                t_size = d3.select(this).attr('size').split('_')
              return t_pos - parseFloat(t_size[1]) * 0.5
            })
            .style('font-size', this.fontSize)
            .text((v_d) => { return v_d + '' })
      return this
        };
    update (v_data, v_dataRange) {
      this.data = v_data
      this.dataRange = v_dataRange || [0, d3.max(this.data)]
      let t_posScale = this.posScale, t_heightScale = this.heightScale,
        t_barWidth = this.barWidth, t_poses = new Array(),
        t_marginWidth = this.marginWidth
      t_posScale.domain(this.dataRange)
      t_heightScale.domain([0, this.dataRange[1] - this.dataRange[0]])
      this.container.selectAll('.' + this.className + ' rect')
            .interrupt()
            .transition()
            .duration(this.duration)
            .attr('y', (v_d, v_i) => {
              let t_pos = t_posScale(v_data[v_i])
              t_poses[v_i] = t_pos
              return t_pos
            })
            .attr('height', (v_d, v_i) => {
              return t_heightScale(v_data[v_i])
            })
      this.container.selectAll('.' + this.className + ' text')
            .attr('size', (v_d, v_i) => {
              return (v_data[v_i] + '').visualSize(this.fontSize).join('_')
            })
            .text((v_d, v_i) => { return v_data[v_i] + '' })
            .attr('x', function (v_d) {
              let t_size = d3.select(this).attr('size').split('_')
              return t_marginWidth + (t_barWidth - parseFloat(t_size[0])) * 0.5
            })
            .interrupt()
            .transition()
            .duration(this.duration)
            .attr('y', function (v_d, v_i) {
              let t_pos = t_poses[v_i],
                t_size = d3.select(this).attr('size').split('_')
              return t_pos - parseFloat(t_size[1]) * 0.5
            })
      return this
    };
    };

  window['PandaHist'] = {
    init: function (v_options) {
      return new pandaHist(v_options)
    }
  }
})()
