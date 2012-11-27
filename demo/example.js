Ext.Loader.setConfig({
    enabled: true
});
Ext.Loader.setPath('Ext.ux.extjs-imagemapper', '..');

Ext.require([
    'Ext.ux.extjs-imagemapper.ImageMapper'
]);

Ext.onReady(function(){

    Ext.create('Ext.data.Store', {
        storeId:'dummy-store',
        fields: ['x', 'y', 'w', 'h'],
        autoLoad: true,
        proxy: {
            type: 'ajax',
            url: 'example.json',
            reader: {
                type: 'json',
                root: 'items'
            }
        }
    });

    Ext.create('Ext.ux.extjs-imagemapper.ImageMapper', {
        width: 500,
        height: 300,

        renderTo: Ext.getBody(),

        src: 'example.jpg',

        store: 'dummy-store'
    });
});
