// Persist name in localStorage
(function(){
    const STORAGE_KEY = 'username';

    function init(){
        const input = document.getElementById('name-input');
        if(!input) return; // nothing to do

        function load(){
            const v = localStorage.getItem(STORAGE_KEY) || '';
            input.value = v;
        }

        function save(val){
            localStorage.setItem(STORAGE_KEY, val || '');
        }

        input.addEventListener('blur', function(e){ save(e.target.value); });

        load();
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

})();
