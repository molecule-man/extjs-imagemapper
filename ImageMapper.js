Ext.define('Ext.ux.extjs-imagemapper.ImageMapper', {
    extend: 'Ext.view.View',
    requires: [
        //'Ext.LoadMask',
    ],
    alias: 'widget.imagemapper',


    mixins: {
        bindable: 'Ext.util.Bindable'
    },


    /**
     * @cfg Ext.data.Store store. Required
     */

    /**
     * @cfg bool zoomOnScroll
     * Determines whether to zoom image and all selections when mouse wheel
     * events occure.
     * Defaults to true
     */
    zoomOnScroll: true,


    /**
    * @cfg string src
    * The src to assign to img that is going to be mapped.
    * Defaults to Ext.BLANK_IMAGE_URL.
    */
    src: Ext.BLANK_IMAGE_URL,


    eventGrabberCls: Ext.baseCSSPrefix+'event-grabber',
    scrollerCls: Ext.baseCSSPrefix+'mapper-scroller',
    selectorClass: Ext.baseCSSPrefix+'mapper-selection',
    imgClass: Ext.baseCSSPrefix+'mapper-img',

    scrollerStyle: 'position: absolute;' +
        'top: 0px; left: 0px;' +
        // right -20 px to ensure that scrollbar is not visible
        'bottom: 0px; right: -20px;' +
        'z-index: 1;' +
        'overflow-x: hidden; overflow-y: scroll;',

    grabberStyle: 'width: 100%; height: 1000%',


    selectorStyle: 'position: absolute;' +
        'left: {[this.getCoordinate(values.x)]}px;' +
        'top: {[this.getCoordinate(values.y)]}px;' +
        'width: {[this.getSize(values.w)]}px;' +
        'height: {[this.getSize(values.h)]}px;' +
        'border: 1px solid #f00;' + 
        'z-index: 2;',
    //selectorStyle: 'top: 


    initComponent: function() {
        var me = this,
            memberFn = {
                disableFormats: true,
                getCoordinate: Ext.bind(me.getNormalizedCoordinate, me),
                getSize: Ext.bind(me.getNormalizedSize, me),
            },

            itemTpl = [
                '<img class="', me.imgClass, '" src="', me.src, '">',
            ].join('');

            // if user wishes to use zoomOnScroll feature additional nodes
            // should be created the main purpose of which is to provide
            // invisible element with scrollbar that overlays image
            if (me.zoomOnScroll) {
                itemTpl += [
                    '<div class="', me.scrollerCls, '" style="',me.scrollerStyle,'">',
                        '<div class="', me.eventGrabberCls, '" style="',me.grabberStyle, '">',
                        '</div>',
                    '</div>',
                ].join('');
            }

            itemTpl += [
                '<tpl for=".">',
                    '<div class="',
                        me.selectorClass,
                        '" style="', me.selectorStyle, '">',
                    '</div>',
                '</tpl>'
            ].join('');

        me.itemSelector = 'div.'+me.selectorClass;
        me.tpl = new Ext.XTemplate(itemTpl, memberFn);

        me.style = {
            position: 'relative',
            overflow: 'hidden'
        };

        me.callParent(arguments);
    },


    getNormalizedCoordinate: function(coordinate) {
        return coordinate;
    },


    getNormalizedSize: function(size) {
        return size;
    }
});
