;(function() {
    window.bootstrap = function() {
        new Dottie();
    };

    var DottieModel = Backbone.Model.extend({
        get_pixels_at: function(x, y) {
            // get pixels for grid section starting at x, y
            var subgrid_pixels = [],
                pixels = this.get('pixels'),
                width = this.get('width'),
                grid_size = this.get('grid_size'),
                first_x = x + y * width,
                last_x = x + (y + grid_size) * width;
            for (x = first_x; x <= last_x; x += width) {
                subgrid_pixels = subgrid_pixels.concat(
                    pixels.slice(x, x + grid_size)
                );
            }
            return subgrid_pixels;
        },
        get_palette_at: function(x, y) {
            // get palette for grid section starting at x, y
            var grid_size = this.get('grid_size');
            var key = [grid_size, x, y].join(':');
            if (!(key in this._palette_cache)) {
                var pixels = this.get_pixels_at(x, y);
                var cmap = MMCQ.quantize(pixels, 8);

                var color_counts = {};
                _.each(pixels, function(pixel) {
                    var color = cmap.map(pixel);
                    var key = color.join(':');
                    color_counts[key] = color_counts[key] + 1 || 1;
                });
                var palette = _.map(color_counts, function (val, key) {
                    var color = _.map(key.split(':'), function(n) { return parseInt(n) });
                    color.percent = val / Math.pow(grid_size, 2);
                    return color;
                });
                palette = _.sortBy(palette, function(color) { return -1 * color.percent });
                this._palette_cache[key] = palette;
            }
            return this._palette_cache[key];
        },
        clear_palette_cache: function() {
            this._palette_cache = {};
        },
        get_scaled_sizes: function() {
            var multiplier = 1.0,
                output_width = this.get('output_width'),
                input_width = this.get('width');

            if (output_width) {
                multiplier = output_width / input_width;
            }
            return {
                'dot_size': this.get('dot_size') * multiplier,
                'grid_size': this.get('grid_size') * multiplier,
                'width': input_width * multiplier,
                'height': this.get('height') * multiplier
            }
        },
        defaults: {
            'dot_shape': 'circle',
            'dot_size': 30,
            'grid_size': 30,
            'output_width': null,
            'show_tooltips': false
        },
        _palette_cache: {},
    });

    var Dottie = Backbone.View.extend({

        initialize: function() {
            this.model = new DottieModel();

            var _this = this;

            $("#file_input").change(function() {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var data_url = e.target.result;
                    _data_url_to_pixels(data_url, function(imageData) {
                        var px_arr = [];
                        for (var i = 0; i < imageData.data.length; i += 4) {
                            // ignore every 4th element, the opacity value
                            px_arr.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
                        }
                        _this.model.clear_palette_cache();
                        _this.model.set({
                            'image_url': data_url,
                            'imageData': imageData,
                            'pixels': px_arr,
                            'width': imageData.width,
                            'height': imageData.height
                        });
                    });
                };
                reader.readAsDataURL(this.files[0]);
            });

            var shape_select = $("#dot_shape");
            _.each(['circle', 'square'], function(shape) {
                var options = { value: shape, text: shape };
                if (shape == this.model.get('dot_shape')) {
                    options.selected = true;
                }
                shape_select.append($("<option>", options));
            }, this);
            shape_select.change(function() {
                _this.model.set('dot_size', $(this).val());
            });

            var size_select = $("#dot_size");
            var dot_sizes = _.range(2, 100);
            _.each(dot_sizes, function(size) {
                var options = { value: size, text: size };
                if (size == this.model.get('dot_size')) {
                    options.selected = true;
                }
                size_select.append($("<option>", options));
            }, this);
            size_select.change(function() {
                var val = parseInt($(this).val(), 10);
                _this.model.set('dot_size', val);
            });

            var grid_select = $("#grid_size");
            var grid_sizes = _.range(2, 100);
            _.each(grid_sizes, function(size) {
                var options = { value: size, text: size };
                if (size == this.model.get('grid_size')) {
                    options.selected = true;
                }
                grid_select.append($("<option>", options));
            }, this);
            grid_select.change(function() {
                var val = parseInt($(this).val(), 10);
                _this.model.set('grid_size', val);
            });

            var output_width = $("#output_width");
            output_width.on('input', _.debounce(function() {
                _this.model.set('output_width', $(this).val());
            }, 350));

            var show_tooltips = $("#show_tooltips");
            if (this.model.get('show_tooltips')) {
                show_tooltips.attr('checked', 'checked');
            }
            show_tooltips.on('click', function() {
                if ($(this).is(':checked')) {
                    _this.model.set('show_tooltips', true);
                } else {
                    _this.model.set('show_tooltips', false);
                }
            });

            $("#save").on('click', function() {
                Canvas2Image.saveAsPNG(document.getElementById('output'));
            });

            this.model.on('change:image_url', function() {
                $("#preview").attr("src", this.model.get('image_url'));
            }, this);

            this.model.on('change', this.render, this);
        },

        render: function() {
            var render_timer = new Timer(),
                palette_timer = new Timer(),
                tooltip_timer = new Timer(),
                dot_timer = new Timer();
            render_timer.start();

            $("#tooltip_layer").html("");

            var canvas = document.getElementById('output'),
                context = canvas.getContext('2d');
            // clear before doing anything else, in case the image size changed.
            context.clearRect(0, 0, canvas.width, canvas.height);

            // dots/grid scale when we change the output size
            var scaled_sizes = this.model.get_scaled_sizes();

            var grid_count_x = Math.round(scaled_sizes.width / scaled_sizes.grid_size),
                grid_count_y = Math.round(scaled_sizes.height / scaled_sizes.grid_size);

            canvas.width = grid_count_x * scaled_sizes.grid_size;
            canvas.height = grid_count_y * scaled_sizes.grid_size;

            for (var grid_y = 0; grid_y < grid_count_y; grid_y++) {
                for (var grid_x = 0; grid_x < grid_count_x; grid_x++) {
                    // input x, y is not scaled
                    var input_x = grid_x * this.model.get('grid_size'),
                        input_y = grid_y * this.model.get('grid_size');
                    var palette = palette_timer.time(this.model.get_palette_at, [input_x, input_y], this.model);
                    if (this.model.get('show_tooltips')) {
                        tooltip_timer.time(this._render_tooltip, [input_x, input_y, palette], this);
                    }
                    // output x, y is scaled
                    var output_x = grid_x * scaled_sizes.grid_size,
                        output_y = grid_y * scaled_sizes.grid_size;
                    dot_timer.time(this._render_dot, [context, output_x, output_y, palette[0]], this);
                }
            }
            render_timer.end();
            console.info('rendering image took', render_timer.get(), 'seconds');
            console.info('  palette:', palette_timer.get(), 'seconds');
            console.info('  tooltip:', tooltip_timer.get(), 'seconds');
            console.info('  dots:', dot_timer.get(), 'seconds');
        },

        _render_dot: function(context, x, y, color) {
            var scaled_sizes = this.model.get_scaled_sizes();
            var grid_size = scaled_sizes.grid_size,
                dot_size = scaled_sizes.dot_size;
            context.fillStyle = _color_to_rgb_css(color);
            switch (this.model.get('dot_shape')) {
                case 'circle':
                    var center_x = x + grid_size / 2,
                        center_y = y + grid_size / 2,
                        radius = dot_size / 2,
                        start_angle = 0,
                        end_angle = 2 * Math.PI;
                    context.beginPath();
                    context.arc(center_x, center_y, radius, start_angle, end_angle);
                    context.fill();
                    context.closePath();
                    break;
                case 'square':
                    // when the grid is bigger than the dot, we want to center
                    // the dot within the grid.
                    var padding = (grid_size - dot_size) / 2;
                    context.fillRect(x + padding, y + padding, dot_size, dot_size);
                    break;
                default:
                    throw 'invalid shape';
            }
        },

        _render_tooltip: function(input_x, input_y, palette) {
            var scaled_sizes = this.model.get_scaled_sizes();
            var $click_catcher = $("<div class='tooltip_area'>").css({
                height: scaled_sizes.grid_size,
                width: scaled_sizes.grid_size
            });

            var $tooltip = $("<div class='tooltip_content'>"),
                $canvas = $("<canvas>"),
                ctx = $canvas[0].getContext('2d');

            var unscaled_grid_size = this.model.get('grid_size');
            $canvas[0].width = unscaled_grid_size;
            $canvas[0].height = unscaled_grid_size;

            // Copy the original pixels into the tooltip for comparison
            ctx.putImageData(
                this.model.get('imageData'),
                -input_x, -input_y,
                input_x, input_y,
                unscaled_grid_size, unscaled_grid_size
            );

            var $palette = $("<div class='palette'>"),
                $palette_pct = $("<div class='palette_pct'>");
            _.each(palette, function(color) {
                $palette.append(
                    $("<div class='palette_color'>").css({
                        'background-color': _color_to_rgb_css(color),
                        'height': unscaled_grid_size
                    })
                );
                $palette_pct.append(
                    $("<div class='palette_color_pct'>").text(parseInt(color.percent * 100, 10) + '%')
                );
            });

            $("#tooltip_layer").append(
                $click_catcher.append(
                    $tooltip.append(
                        $("<span class='coords'>").text(input_x + ", " + input_y),
                        $canvas,
                        $("<div class='palette_container'>").append(
                            $palette,
                            $palette_pct
                        ),
                        $("<span class='arrow'>")
                    )
                )
            );

            // position it after it is filled with content
            $tooltip.css({
                'left': -1 * $tooltip.outerWidth() / 2 + scaled_sizes.grid_size / 2,
                'bottom': scaled_sizes.grid_size / 2
            });

            $click_catcher.click(function() {
                $tooltip.toggle();
            });
        }
    });

    var _data_url_to_pixels = function(data_url, callback) {
        var img = new Image();
        img.src = data_url;

        img.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            var ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0);
            var img_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            callback(img_data);
        };
    };

    var _color_to_rgb_css = function(pixel) {
        return 'rgb(' + pixel.join(',') + ')';
    };

    var Timer = function() {
        this._total_time = 0;
    };
    Timer.prototype.time = function(fn, args, context) {
        var start = new Date,
            output = fn.apply(context, args),
            end = new Date;
        this._total_time += (end - start);
        return output;
    };
    Timer.prototype.start = function() {
        this._start_time = new Date;
    };
    Timer.prototype.end = function() {
        this._total_time = (new Date - this._start_time);
    };
    Timer.prototype.get = function() {
        return this._total_time / 1000;
    };

})();
