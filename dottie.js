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
                    _data_url_to_pixels(data_url, function(pixels, width, height) {
                        _this.model.set({
                            'image_url': data_url,
                            'pixels': pixels,
                            'width': width,
                            'height': height
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
            var canvas = document.getElementById('output'),
                width = this.model.get('width'),
                height = this.model.get('height');

            canvas.width = width;
            canvas.height = height;

            var context = canvas.getContext('2d');
            var grid_size = this.model.get('grid_size');

            for (var y = 0; y < height; y += grid_size) {
                for (var x = 0; x < width; x += grid_size) {
                    var px = this.model.get_pixels_at(x, y);
                    var cmap = MMCQ.quantize(px, 5);
                    var palette = cmap.palette();
                    context.fillStyle = "rgb(" + palette[0].join(",") + ")";
                    if (x == 0) {
                        console.log(px);
                        console.log(palette);
                        console.log(context.fillStyle);
                    }
                    context.fillRect(x, y, x + grid_size, y + grid_size);
                }
            }
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
            var px_arr = [];
            for (var i = 0; i < img_data.data.length; i += 4) {
                // ignore every 4th element, the opacity value
                px_arr.push([img_data.data[i], img_data.data[i + 1], img_data.data[i + 2]]);
            }
            callback(px_arr, img_data.width, img_data.height);
        };
    };

    var _get_pixels_at = function(x1, y1, x2, y2) {
    };

})();
