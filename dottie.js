(function() {
    window.bootstrap = function() {
        new Dottie();
    };

    var DottieModel = Backbone.Model.extend({
        get_pixels_at: function(x, y) {
            var subgrid_pixels = [],
                pixels = this.get('pixels'),
                width = this.get('width'),
                grid_size = this.get('grid_size'),
                last_x = x + (y + grid_size) * width;
            for (x; x <= last_x; x += width) {
                subgrid_pixels = subgrid_pixels.concat(
                    pixels.slice(x, x + grid_size)
                );
            }
            return subgrid_pixels;
        },
        get_palette_at: function(x, y) {
            var key = [this.get('grid_size'), x, y].join(':');
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
                    return [val, _.map(key.split(':'), function(n) { return parseInt(n) })];
                });
                palette = _.sortBy(palette, function(item) { return -1 * item[0] });
                palette = palette.map(function(tuple) { return tuple[1] });
                this._palette_cache[key] = palette;
            }
            return this._palette_cache[key];
        },
        _palette_cache: {},
        defaults: {
            'dot_size': 30,
            'grid_size': 30
        }
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

            var dot_select = $("#dot_size");
            var dot_sizes = _.range(10, 50, 5);
            _.each(dot_sizes, function(size) {
                var options = { value: size, text: size };
                if (size == this.model.get('dot_size')) {
                    options.selected = true;
                }
                dot_select.append($("<option>", options));
            }, this);
            dot_select.change(function() {
                var val = parseInt($(this).val(), 10);
                _this.model.set('dot_size', val);
            });

            var grid_select = $("#grid_size");
            var grid_sizes = _.range(10, 100, 5);
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

            this.model.on('change:image_url', function() {
                $("#preview").attr("src", this.model.get('image_url'));
            }, this);

            this.model.on('change', this.render, this);
        },

        render: function() {
            $("#tooltip_layer").html("");

            var canvas = document.getElementById('output'),
                width = this.model.get('width'),
                height = this.model.get('height'),
                grid_size = this.model.get('grid_size'),
                dot_size = this.model.get('dot_size');

            var grid_width = Math.round(width / grid_size) * grid_size,
                grid_height = Math.round(height / grid_size) * grid_size;

            canvas.width = grid_width;
            canvas.height = grid_height;

            var context = canvas.getContext('2d');
            context.clearRect(0, 0, width, height);

            for (var y = 0; y < grid_height; y += grid_size) {
                for (var x = 0; x < grid_width; x += grid_size) {
                    var palette = this.model.get_palette_at(x, y);
                    this._render_tooltip(x, y, palette);

                    context.fillStyle = _color_to_rgb_css(palette[0]);
                    context.fillRect(x, y, dot_size, dot_size);
                }
            }
        },

        _render_tooltip: function(x, y, palette) {
            var grid_size = this.model.get('grid_size');
            var $click_catcher = $("<div class='tooltip_area'>").css({
                height: grid_size,
                width: grid_size
            });

            var $tooltip = $("<div class='tooltip_content'>"),
                $canvas = $("<canvas>"),
                ctx = $canvas[0].getContext('2d');
            $canvas[0].width = grid_size;
            $canvas[0].height = grid_size;

            // Copy the original pixels into the tooltip for comparison
            ctx.putImageData(this.model.get('imageData'), -x, -y, x, y, grid_size, grid_size);

            var $palette = $("<div class='palette'>");
            _.each(palette, function(color) {
                $palette.append($("<div class='palette_color'>").css(
                    'background-color', _color_to_rgb_css(color)
                ));
            });

            $("#tooltip_layer").append(
                $click_catcher.append(
                    $tooltip.append(
                        $canvas,
                        $palette,
                        $("<span class='arrow'>")
                    )
                )
            );

            $tooltip.css({
                'left': -1 * $tooltip.outerWidth() / 2 + grid_size / 2,
                'top': -1 * grid_size
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


})();
