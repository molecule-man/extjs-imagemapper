Ext.define('Ext.ux.extjs-imagemapper.ImageMapper', {
    extend: 'Ext.view.View',
    requires: [
        //'Ext.LoadMask',
        'Ext.dd.DragTracker'
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
     * events occur.
     * Defaults to true
     */
    zoomOnScroll: true,


    /**
     * @cfg string src
     * The src to assign to img that is going to be mapped.
     * Defaults to Ext.BLANK_IMAGE_URL.
     */
    src: Ext.BLANK_IMAGE_URL,

    /**
     * @cfg float zoomStep
     * value which will be added (or substracted if image is zoomed out) to zoom
     * factor (zoom factor equals to 1 if image is not zoomed. if zoom factor
     * equals to, for example, 2 image will have twice as big linear size as its
     * original size
     */
    zoomStep: 0.2,


    minZoom: 0.2,
    maxZoom: 3,

    style: {background: 'black'},


    eventGrabberCls: Ext.baseCSSPrefix+'event-grabber',
    scrollerCls: Ext.baseCSSPrefix+'mapper-scroller',
    selectorClass: Ext.baseCSSPrefix+'mapper-selection',
    imgClass: Ext.baseCSSPrefix+'mapper-img',


    initComponent: function() {
        var me = this,
            memberFn = {
                disableFormats: true,
                getCoordinate: Ext.bind(me.getNormalizedCoordinate, me),
                getSize: Ext.bind(me.getNormalizedSize, me),
            },

            // css style to apply to selection (mapping) node
            selectorStyle = [
                'position:  absolute;',
                'left:      {[this.getCoordinate(values.x)]}px;',
                'top:       {[this.getCoordinate(values.y)]}px;',
                'width:     {[this.getSize(values.w)]}px;',
                'height:    {[this.getSize(values.h)]}px;',
                'border:    1px solid #f00;', 
                'z-index:   2;'
            ].join(''),

            // css style to apply to scroller node (element which provides
            // invisible scrollbar which helps to capture mouse wheel events)
            scrollerStyle = [
                'position:      absolute;',
                'top:           0px;',
                'left:          0px;',
                'bottom:        0px;',
                // right -20 px to ensure that scrollbar is not visible
                // and is not therefore capturing click events
                'right:         -20px;',
                'z-index:       1;',
                'overflow-x:    hidden;',
                'overflow-y:    scroll;'
            ].join(''),

            // css style to apply to event grabber (element which is part of
            // scroller. It has height set to 1000% which is make possible to
            // scroll parent container. As it is positioned absolutely to
            // overlay image it will capture all events that are meant to be
            // fired on image. That's why it is called eventGrabber)
            grabberStyle = 'width: 100%; height: 1000%',

            itemTpl = [
                '<tpl for=".">',
                    '<div class="',
                        me.selectorClass,
                        '" style="', selectorStyle, '">',
                    '</div>',
                '</tpl>',
            ].join('');

        me.imgTpl = [
            '<img class="', me.imgClass, '" src="', me.src, '" style="position:absolute;" />',
        ].join('');

        me.scrollerTpl = [
            '<div class="', me.scrollerCls, '" style="', scrollerStyle,'">',
                '<div class="', me.eventGrabberCls, '" style="', grabberStyle, '">',
                '</div>',
            '</div>',
        ].join('');

        me.itemSelector = 'div.'+me.selectorClass;
        me.tpl = new Ext.XTemplate(itemTpl, memberFn);

        me.style = {
            position: 'relative',
            overflow: 'hidden'
        };

        me.addEvents(
            /**
             * @event imgposchanged
             * Fires when position of img element is changed
             * @param Ext.dom.Element imgEl. img element
             * @param object newPos. new coordinates in format:
             *      {x: <newX>, y: <newY>} 
             * @param object oldPos. old coordinates in format:
             *      {x: <oldX>, y: <oldY>} 
             */
            'imgposchanged',

            /**
             * @event imgsizechanged
             * Fires when size of img element is changed
             * @param Ext.dom.Element imgEl. img element
             * @param object newSize. new size in format:
             *      {width: <newWidth>, height: <newHeight>} 
             * @param object oldSize. old size in format:
             *      {width: <oldWidth>, height: <oldHeight>} 
             */
            'imgsizechanged'
        );

        me.geometry = {};

        me.callParent(arguments);

        me.on('imgposchanged', me.onPosChange, me);
        me.on('imgsizechanged', me.onSizeChange, me);
    },


    getNormalizedCoordinate: function(coordinate) {
        return coordinate;
    },


    getNormalizedSize: function(size) {
        return size;
    },


    afterRender: function() {
        var me = this;

        var imgDom = Ext.DomHelper.insertHtml('beforeEnd', Ext.getDom(me.el), me.imgTpl);
        me.imgEl = Ext.get(imgDom);
        me.imgEl.on('load', me.onImgLoad, me);
        me.eventGrabber = me.el;

        if (me.zoomOnScroll) {
            this.hookupWheelEvent();
        }

        me.callParent(arguments);
    },


    initEvents: function() {
        var me = this;
        me.imgDragger = Ext.create('Ext.dd.DragTracker', {
            el: me.imgEl,
            onBeforeStart: Ext.bind(me.onBeforeImgDrag, me),
            onDrag: Ext.bind(me.onImgDrag, me)
        });

        me.callParent(arguments);
    },


    hookupWheelEvent: function() {
        var me = this, eventName = 'mousewheel';
        if ('onwheel' in document) {
            eventName = 'wheel';
        }
        me.mon(me.el, eventName, function(e) {
            var direction,
                browserEvent = e.browserEvent,
                el = me.el;

            // new firefox
            if (browserEvent.deltaY) {
                direction = browserEvent.deltaY*(-1);
            // ie and webkit
            } else if (e.browserEvent.wheelDelta) {
                direction = browserEvent.wheelDelta;
            // older firefox
            } else {
                direction = browserEvent.detail*(-1);
            }

            me.onWheel(e, direction, e.getX() - el.getX(), e.getY() - el.getY());
        }, me);
    },


    onWheel: function(event, direction, x, y) {
        this.zoom(direction, x, y);
    },


    onBeforeImgDrag: function(e) {
        this.imgLastXY = e.getXY();

        // allow dragging only if shiftKey is pressed
        return !!e.shiftKey;
    },


    onImgDrag: function(e) {
        var me = this,
            lastXY = me.imgLastXY,
            deltaX = e.getX() - lastXY[0],
            deltaY = e.getY() - lastXY[1];

        me.setImgX(me.geometry.x + deltaX);
        me.setImgY(me.geometry.y + deltaY);
        me.imgLastXY = e.getXY();
    },


    onPosChange: function() {
        console.log('pos', arguments);
    },


    onSizeChange: function() {
        console.log('size', arguments);
    },


    /**
     * Setups image with new zoomFactor. zoomFactor of 1 corresponds to image's
     * original size. zoomFactor of 2 corresponds to image's size twice as big
     * as original size
     * @param float zoomFactor
     * @fires imgsizechanged
     */
    setZoomFactor: function(zoomFactor) {
        var me = this;
            originalSize = me.getImgNaturalSize(),
            newWidth = Math.round(originalSize.width * zoomFactor),
            newHeight = Math.round(originalSize.height * zoomFactor);

        me.zoomFactor = zoomFactor;

        me.imgEl.setWidth(newWidth);
        me.imgEl.setHeight(newHeight);
        me.fireEvent(
            'imgsizechanged',
            me.imgEl,
            {width: newWidth, height: newHeight},
            originalSize,
            zoomFactor
        );

        me.geometry.w = newWidth;
        me.geometry.h = newHeight;
    },


    /**
     * Setups image with new x coordinate (relatively to this.el)
     * @param int x
     */
    setImgX: function(x) {
        var me = this,
            oldPos = {x: me.geometry.x, y: me.geometry.y};
        me.imgEl.setLeft(x);
        me.geometry.x = x;
        me.fireEvent('imgposchanged', me.imgEl, { x: x, y: oldPos.y}, oldPos);
    },


    /**
     * Setups image with new y coordinate (relatively to this.el)
     * @param int y
     */
    setImgY: function(y) {
        var me = this,
            oldPos = {x: me.geometry.x, y: me.geometry.y};
        me.imgEl.setTop(y);
        me.geometry.y = y;
        me.fireEvent('imgposchanged', me.imgEl, {x: oldPos.x, y: y}, oldPos);
    },


    /**
     * zooms image element
     * @param int direction. If it is > 0 than image will be zoom in
     * @param int fixAtX. If specified image will be zoomed in such a way that
     * x coordinate of corresponding point of image will not change
     * @param int fixAtY. If specified image will be zoomed in such a way that
     * y coordinate of corresponding point of image will not change
     */
    zoom: function (direction, fixAtX, fixAtY) {
        var me = this;
        direction = (direction > 0) ? 1 : -1;
        var newZoomFactor = me.zoomFactor + direction * me.zoomStep;

        if (newZoomFactor < me.minZoom || me.maxZoom < newZoomFactor) {
            return;
        }

        me.setZoom(newZoomFactor, fixAtX, fixAtY);
    },


    /**
     * zooms image element according to passed zoomFactor
     * @param float zoomFactor. degree of zoom
     * @param int fixAtX. If specified image will be zoomed in such a way that
     * x coordinate of corresponding point of image will not change
     * @param int fixAtY. If specified image will be zoomed in such a way that
     * y coordinate of corresponding point of image will not change
     */
    setZoom: function (zoomFactor, fixAtX, fixAtY) {
        var me = this;
        var oldZoomFactor = me.zoomFactor;
        me.zoomFactor = zoomFactor;

        me.setZoomFactor(zoomFactor);

        var relFactor = zoomFactor / oldZoomFactor;

        if (fixAtX) {
            var newX = Math.round(fixAtX - relFactor * (fixAtX - me.geometry.x));
            me.setImgX(newX);
        }

        if (fixAtY) {
            var newY = Math.round(fixAtY - relFactor * (fixAtY - me.geometry.y));
            me.setImgY(newY);
        }
    },


    refreshImg: function() {
        var me = this;
        me.imgSize = null;

        this.adjustImgSize();
    },


    getImgNaturalSize: function() {
        if (this.imgSize) {
            return this.imgSize;
        }

        var normalWidth = this.imgEl.getAttribute('naturalWidth');

        if (!normalWidth) {
            this.imgSize = this.getImgOriginalSize();
            return this.imgSize;
        }

        var normalHeight = this.imgEl.getAttribute('naturalHeight');

        return { width: normalWidth, height: normalHeight };
    },


    getImgOriginalSize: function() {
        var img = new Image();
        img.src = this.src;
        return {width: img.width, height: img.height};
    },


    onImgLoad: function () {
        this.refreshImg();
    },


    adjustImgSize: function () {
        var naturalSize = this.getImgNaturalSize(),
            parentSize = this.el.getSize();

        if (naturalSize.width == 0 || naturalSize.height == 0 ||
            parentSize.width == 0 || parentSize.height == 0 )
        {
            Ext.Error.raise({
                msg: 'Either image or image\'s parent has zero size',
                imgSize: naturalSize,
                parentSize: parentSize,
                cmp: 'ImageMapper',
                method: 'adjustImgSize'
            });
        }

        var zoomFactor = parentSize.width / naturalSize.width,
            adjustedX = 0,
            adjustedY = 0,
            adjustedWidth = 0,
            adjustedHeight = zoomFactor * naturalSize.height;

        if (adjustedHeight < parentSize.height) {
            adjustedY = Math.round((parentSize.height - adjustedHeight) / 2);
        } else {
            zoomFactor = parentSize.height / naturalSize.height;
            adjustedWidth = zoomFactor * naturalSize.width;
            adjustedX = Math.round((parentSize.width - adjustedWidth) / 2);
        }

        this.setZoomFactor(zoomFactor);
        this.setImgX(adjustedX);
        this.setImgY(adjustedY);
    },


    adjustSelections: function() {
    }
});
