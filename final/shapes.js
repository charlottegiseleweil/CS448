function plotShapes(data, containerId, chartSize){
  // ----- START BASIC VARIABLES -----
  var canvas = d3.select(containerId)
    .append('canvas')
    .attr('width', chartSize.width)
    .attr('height', chartSize.height)
    .style("padding", chartSize.margin.top + "px " + 
      chartSize.margin.right + "px " + 
      chartSize.margin.bottom + "px " + 
      chartSize.margin.left + "px "),
    context = canvas.node().getContext('2d');

  var svg = d3.select(containerId)
    .append('svg')
    .attr('width', chartSize.width)
    .attr('height', chartSize.height)
    //.style('top', titlebox.height + titlebox.top + titlebox.bottom),
    g = svg.append("g").attr("transform", "translate(" + chartSize.margin.left + "," + chartSize.margin.top + ")");
    width = chartSize.width - margin.left - margin.right,
    height = chartSize.height - margin.top - margin.bottom;

  var parseDate = d3.timeParse("%m/%e/%Y %H:%M");

  var x = d3.scaleTime().range([0, width]),
    y = d3.scaleLinear().range([height, 0]),
    z = d3.scaleOrdinal(d3.schemeCategory10);

  var line = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.fraction); });

  var backgroundline = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.fraction); })
    .context(context);


  var brushes = [];
  var brushCounter = 0;
  var selectedIds, allIds;
  newBrush();


  var trees,
      shapes;
  // ----- END BASIC VARIABLES -----

  // ----- START DATA PROCESSING -----
  shapes = data.columns.slice(1).map(function(id, index) {
    values = data.map(function(d) {
        return {date: d.date, fraction: d[id], id: id, index: index};
      });

    return {
      id: id,
      values: values
    };
  });

  allIds = shapes.map(function(d){
    return d.id;
  })

  // create tree
  var allValues = [];
  shapes.forEach(function(data){
    allValues = allValues.concat(data.values);
  });

  var extent = [
    [
      d3.min(shapes, function(c) { return d3.min(c.values, function(d) { return x(d.date); }); }) -1,
      d3.min(shapes, function(c) { return d3.max(c.values, function(d) { return y(d.fraction); }); }) -1
    ],
    [
      d3.max(shapes, function(c) { return d3.min(c.values, function(d) { return x(d.date); }); }) + 1,
      d3.max(shapes, function(c) { return d3.max(c.values, function(d) { return y(d.fraction); }); }) + 1
    ]
  ]

  x.domain(d3.extent(data, function(d) { return d.date; }));

  y.domain([
    d3.min(shapes, function(c) { return d3.min(c.values, function(d) { return d.fraction; }); }),
    d3.max(shapes, function(c) { return d3.max(c.values, function(d) { return d.fraction; }); })
  ]);

  z.domain(shapes.map(function(c) { return c.id; }));

  trees = data.columns.slice(1).map(function(id, index) {
    values = data.map(function(d) {
        return {date: d.date, fraction: d[id], id: id, index: index};
      });

    var tree = d3.quadtree()
      .extent([[0, 0], [width + 1, height + 1]])
      .x(function(d){ return x(d.date); })
      .y(function(d){return y(d.fraction); })
      .extent(extent)
      .addAll(values);
      
    return {
      id: id,
      tree: tree
    };
  });

  // ----- END DATA PROCESSING -----

  // ----- START PLOTTING -----
  // plot canvas
  context.beginPath();
  shapes.forEach(function(d){
    backgroundline(d.values);
  });
  context.lineWidth = 1.5;
  context.strokeStyle = "gray";
  context.globalAlpha = 0.1;
  context.stroke();


  g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

   g.append("g")
       .attr("class", "axis axis--y")
       .call(d3.axisLeft(y))

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("dy", "1em")
    .attr("x",0-(chartSize.height/2))
    .style("text-anchor", "middle")
    .text("Energy Fraction");

  // ----- END PLOTTING -----

  // ----- START AUXILARY FUNCTIONS -----

  function brushend(){
    // add brush only if the last brush is not empty
    var topBrush = 'b' + (brushCounter -1);
    // if this the top brush AND there has been a change in the
    // selection
    if (this.id === topBrush){
      var lastBrushSelection = d3.brushSelection(this);
      if (lastBrushSelection[0] !== lastBrushSelection[1]){
        newBrush();
      }
    }
  }

  function brushed() {
    var thisId = this.id; // for some reason I cant dynamically access it
    if (d3.event.sourceEvent.shiftKey){
      brushes = brushes.filter(function(d){
        return d.id !== thisId;
      })
      this.remove();
      updateFilter();
      stock_filtered = stocks.filter(function(d, i){
          return selectedIds.has(d.id)
        });
      update(stock_filtered);
      return
    }
    var s = d3.event.selection,
        x0 = s[0][0],
        y0 = s[0][1],
        x1 = s[1][0],
        y1 = s[1][1],
        max = 0;
    var thisBrush = brushes.find(function(d){
      return thisId == d.id;
    });
    thisBrush.selection = treeSearch2(trees, x0, y0, x1, y1);
    thisBrush.selected = true;
    
    updateFilter();
    
    stock_filtered = stocks.filter(function(d, i){
          return selectedIds.has(d.id)
        });
    update(stock_filtered);
  }

  function updateFilter() {
    var activeBrushes = brushes.filter(function(b){
      return b.selected;
    })
    if (activeBrushes.length === 0){
      selectedIds = [];
    } else{
      selectedIds = allIds;
      activeBrushes.forEach(function(b){
        selectedIds = selectedIds.filter(function(i){
          return b.selection.has(i);
        })
      });
    }
    selectedIds = new Set(selectedIds);
  }

  function treeSearchBool(quadtree, x0, y0, x3, y3) {
    var found = false;
    quadtree.visit(function(node, x1, y1, x2, y2) {
      if (!node.length) {
        do {
          var d = node.data;
          //d.scanned = true;
  
          if ((x(d.date) >= x0) && (x(d.date) < x3) && (y(d.price) >= y0) && (y(d.price) < y3)){
            found = true;
            return true;
          };
          //d.selected = (d[0] >= x0) && (d[0] < x3) && (d[1] >= y0) && (d[1] < y3);
        } while (node = node.next && !found);
      }
      //return false;
      return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0 || found;
    });
    return found;
  }

function treeSearch2(trees, x0, y0, x3, y3) {
    // for each tree search for the point, if point, add to set.
    var selected = new Set();
    trees.forEach(function(t){
      if (treeSearchBool(t.tree, x0, y0, x3, y3)){
        selected.add(t.id);
      };
  
    });
    return selected;
  }


  // ----- END plotShapes -----
}


