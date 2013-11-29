(function() {
    window.bootstrap = function() {
        $("#file_input").change(function() {
            console.log(this.files);
        });
    };
})();
