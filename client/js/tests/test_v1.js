              showTiling_new: function (df) {
                // Step 1:   get the layout
                let submapLayout = Geometry.layout.submap(this.collection.subTree, this.fMatrix, this.fCodes.codes, Config.get('gridType'), 2)
                submapLayout.getMap()
                df.resolve()
              },