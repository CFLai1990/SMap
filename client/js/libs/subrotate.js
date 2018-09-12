(function () {
  'use strict'
  window['SubRotate'] = {
    // makeSigns:   2^length kinds of signs (1 or -1)
    makeSigns: function (v_length) {
      let t_signs = new Array(),
        t_s = new Array(v_length)
      t_s.fill(1)
      t_signs.push(t_s)
      for (let i = 0; i < v_length; i++) {
        let tt_signs = new Array()
        for (let j = 0; j < t_signs.length; j++) {
          let tt_sign = t_signs[j],
            tt_s = new Array(v_length)
          for (let k = 0; k < v_length; k++) {
            let tt_div = (k == i) ? (-1) : 1
            tt_s[k] = tt_sign[k] * tt_div
          }
          tt_signs.push(tt_s)
        }
        t_signs = [...t_signs, ...tt_signs]
      }
      return t_signs
    }, // end of makeSigns

    makeOrders: function (v_length) {
      let t_ordering = function (v_ords, v_i, v_rest, v_all) {
          let t_rest = [...v_rest, v_ords[v_i]],
            t_ords = [...v_ords]
          t_ords.splice(v_i, 1)
          for (let i = 0; i < t_ords.length; i++) {
            t_ordering(t_ords, i, t_rest, v_all)
          }
          if (t_ords.length == 0) {
            v_all.push(t_rest)
          }
        },
        t_all = new Array(),
        t_orders = new Array(v_length)
      for (let i = 0; i < v_length; i++) {
        t_orders[i] = i
      }
      for (let i = 0; i < v_length; i++) {
        t_ordering(t_orders, i, new Array(), t_all)
      }
      return t_all
    },

    // getCandidate:   rotate the point
    getCandidate: function (signs, orders, point) {
      let result = new Array(orders.length)
      for (let i = 0; i < orders.length; i++) {
        result[orders[i]] = point[i] * signs[i]
      }
      return result
    }, // end of getCandidate

    // testCandidatesByPoint:   rotate the point in order to make it closer to the target
    testCandidatesByPoint: function (signs, orders, point, target) {
      let result = { min: Infinity, order: null, sign: null }
      for (let j = 0; j < signs.length; j++) {
        let sign = signs[j] // all kinds of signs
        for (let k = 0; k < orders.length; k++) {
          let order = orders[k] // all kinds of orders
          let candidate = this.getCandidate(sign, order, point)
          let distance = 0
          for (let i = 0; i < target.length; i++) {
            distance += Math.pow((target[i] - candidate[i]), 2)
          } // calculate the distance between the candidate and the target
          if (distance < result.min) {
            result.min = distance
            result.order = order
            result.sign = sign
          }
        }
      }
      return result
    }, // end of testCandidatesByPoint

    testCandidatesByGroup: function (v_signs, v_orders, v_data, v_targets) {
      let t_result = {
        min: Infinity,
        order: null,
        sign: null
      }
      for (let j = 0; j < v_signs.length; j++) {
        let t_sign = v_signs[j]
        for (let k = 0; k < v_orders.length; k++) {
          let t_order = v_orders[k],
            t_div = 0
          for (let i = 0; i < v_data.length; i++) {
            let t_cand = this.getCandidate(t_sign, t_order, v_data[i])
            for (let l = 0; l < t_cand.length; l++) {
              t_div += Math.pow((t_cand[l] - t_cand[l]), 2)
            }
          }
          if (t_div < t_result.min) {
            t_result.min = t_div
            t_result.order = t_order
            t_result.sign = t_sign
          }
        }
      }
      return t_result
    },

    centerize: function (v_arr, v_length, v_sign) {
      let t_arr = new Array(v_arr.length)
      if (v_sign) {
        for (let i = 0; i < v_arr.length; i++) {
          let t_d = v_arr[i],
            t_data = new Array(v_length)
          for (let j = 0; j < v_length; j++) {
            t_data[j] = (t_d[j] - 0.5) * 2
          }
          t_arr[i] = t_data
        }
      } else {
        for (let i = 0; i < v_arr.length; i++) {
          let t_d = v_arr[i],
            t_data = new Array(v_length)
          for (let j = 0; j < v_length; j++) {
            t_data[j] = t_d[j] * 0.5 + 0.5
            if (t_data[j] > 1) {
              t_data[j] = 1
            }
            if (t_data[j] < Number.EPSILON) {
              t_data[j] = 0
            }
          }
          t_arr[i] = t_data
        }
      }
      return t_arr
    },

    rotate: function (v_arr, v_bestFit, v_length) {
      let t_order = v_bestFit.order,
        t_sign = v_bestFit.sign
      for (let i = 0; i < v_arr.length; i++) {
        let tt_arr = [],
          tt_data = v_arr[i]
        for (let j = 0; j < tt_data.length; j++) {
          let t_ord = t_order[j]
          tt_arr[t_ord] = tt_data[j] * t_sign[j]
        }
        v_arr[i] = tt_arr
      }
      return v_arr
    },

    pointMoveTo: function (v_arr, v_pointID, v_target) {
      let t_length = v_target.length
      let t_signs = this.makeSigns(t_length)
      let t_orders = this.makeOrders(t_length)
      let t_arr = this.centerize(v_arr, t_length, true)
      let t_target = this.centerize([v_target], t_length, true)[0]
      let t_point = t_arr[v_pointID]
      let t_bestFit = this.testCandidatesByPoint(t_signs, t_orders, t_point, t_target)
      t_arr = this.rotate(t_arr, t_bestFit, t_length)
      t_arr = this.centerize(t_arr, t_length, false)
      return t_arr
    },

    groupMoveTo: function (v_arr, v_targets) {
      let t_length = v_targets[0].length,
        t_signs = this.makeSigns(t_length),
        t_orders = this.makeOrders(t_length),
        t_arr = this.centerize(v_arr, t_length, true),
        t_targets = this.centerize(v_targets, t_length, true),
        t_bestFit = this.testCandidatesByGroup(t_signs, t_orders, t_arr, t_targets)
      t_arr = this.rotate(t_arr, t_bestFit, t_length)
      t_arr = this.centerize(t_arr, t_length, false)
      return t_arr
    }
  }
})()
