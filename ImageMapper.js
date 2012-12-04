Ext.define('Ext.ux.extjs-imagemapper.ImageMapper', {
    extend: 'Ext.view.View',
    requires: [
        //'Ext.LoadMask',
        'Ext.resizer.Resizer',
        'Ext.dd.DragTracker'
    ],
    alternateClassName: ['BAS.ux.extjs-imagemapper.ImageMapper'],
    alias: 'widget.imagemapper',


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
    maxZoom: 4,

    style: {background: 'black'},


    eventGrabberCls: Ext.baseCSSPrefix+'event-grabber',
    scrollerCls: Ext.baseCSSPrefix+'mapper-scroller',
    selectorClass: Ext.baseCSSPrefix+'mapper-selection',
    imgClass: Ext.baseCSSPrefix+'mapper-img',


    initComponent: function() {
        var me = this,

            // css style to apply to selection (mapping) node
            selectorStyle = [
                'position:  absolute;',
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
        me.tpl = new Ext.XTemplate(itemTpl);

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
            'imgsizechanged',

            /**
             * @event selectioncreate
             * Fires when new selection created
             * @param Ext.data.Model selection record
             */
            'selectioncreate',

            /**
             * @event selectionupdate
             * Fires when selection updated
             * @param Ext.data.Model selection record
             */
            'selectionupdate'
        );

        me.geometry = {};
        me.resizers = [];

        me.callParent(arguments);

        me.on('imgposchanged', me.onPosChange, me);
        me.on('imgsizechanged', me.onSizeChange, me);
    },


    setSrc: function(src) {
        this.imgSize = null;
        this.imgEl.set({src: src});
    },


    afterRender: function() {
        var me = this,
            domHelper = Ext.DomHelper || Ext.core.DomHelper;

        var imgDom = domHelper.insertHtml('beforeEnd', Ext.getDom(me.el), me.imgTpl);
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

        me.elDragger = Ext.create('Ext.dd.DragTracker', {
            el: me.el,
            onBeforeStart: Ext.bind(me.onBeforeElDrag, me),
            onStart: Ext.bind(me.onStartElDrag, me),
            onDrag: Ext.bind(me.onElDrag, me),
            onEnd: Ext.bind(me.onEndElDrag, me),
        });

        me.callParent(arguments);
    },


    refresh: function() {
        this.callParent(arguments);
        this.adjustSelections();
        this.hookupResizers();
    },


    onAdd: function(ds, records) {
        this.callParent(arguments);
        this.adjustSelections(records);
        this.hookupResizers();
    },


    onUpdate: function() {
        this.callParent();
    },


    hookupResizers: function() {
        var me = this;

        me.clearResizers();

        var nodes = me.all.elements,
            resizer,
            node;

        for (var i = 0, total = nodes.length; i < total; i++) {
            node = nodes[i];
            var resizer = Ext.create('Ext.resizer.Resizer', {
                handles: 'all',
                target: node
            });

            me.mon(resizer, 'resizedrag', me.onResizeDrag, me);
            me.mon(resizer, 'resize', me.onSelectionResize, me);

            me.resizers.push(resizer);
        }
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


    clearResizers: function() {
        var resizers = this.resizers,
            total = resizers[total];
        for (var i=0; i < total; i++) {
            resizers[i].destroy();
        }

        this.resizers = [];
    },


    /**
     * get xy coordinates relatively to image el for the case when zoomFactor
     * equals to 1
     * @param Ext.dom.Element node
     * @return array
     */
    getSelectionOriginalXY: function(node) {
        var me = this,
            zoomFactor = me.zoomFactor,
            offsetX = me.imgEl.getX(),
            offsetY = me.imgEl.getY(),
            xy;

        if (Ext.isArray(node)) {
            xy = node;
        } else {
            xy = node.getXY();
        }
        var originalX = Math.round((xy[0] - offsetX) / zoomFactor),
            originalY = Math.round((xy[1] - offsetY) / zoomFactor);

        return [originalX, originalY];
    },


    /**
     * get xy coordinates relatively to page for the current zoomFactor
     * @param array xy
     * @return array
     */
    getSelectionNormalizedXY: function(xy) {
        var me = this,
            zoomFactor = me.zoomFactor,
            offsetX = me.imgEl.getX(),
            offsetY = me.imgEl.getY(),
            normalizedX = Math.round(offsetX + xy[0] * zoomFactor),
            normalizedY = Math.round(offsetY + xy[1] * zoomFactor);

        return [normalizedX, normalizedY];
    },


    /**
     * get size of selection for the case when zoomFactor
     * equals to 1
     * @param Ext.dom.Element node
     * @return array
     */
    getSelectionOriginalSize: function(node) {
        var me = this,
            zoomFactor = me.zoomFactor,
            originalW = Math.round(node.getWidth() / zoomFactor),
            originalH = Math.round(node.getHeight() / zoomFactor);

        return {width: originalW, height: originalH};
    },


    /**
     * get size of selection for the current zoomFactor
     * @param array size
     * @return array
     */
    getSelectionNormalizedSize: function(size) {
        var me = this,
            zoomFactor = me.zoomFactor,
            normW = Math.round(size.width * zoomFactor),
            normH = Math.round(size.height * zoomFactor);

        return {width: normW, height: normH};
    },


    onResizeDrag: function(resizer, width, height) {
        var me = this,
            node = resizer.target,
            originalXY = me.getSelectionOriginalXY(node),
            newXY = me.getSelectionNormalizedXY(originalXY),
            originalSize = me.getSelectionOriginalSize(node),
            newSize = me.getSelectionNormalizedSize(originalSize);

        node.setXY(newXY);
        node.setSize(newSize);
    },


    onSelectionResize: function(resizer, width, height) {
        var me = this,
            node = resizer.target,
            record = me.getRecord(node),
            originalSize = me.getSelectionOriginalSize(node),
            originalXY = me.getSelectionOriginalXY(node);
        
        record.set({
            'x': originalXY[0],
            'y': originalXY[1],
            'w': originalSize.width,
            'h': originalSize.height
        });

        me.adjustSelection(record);
        me.fireEvent('selectionupdate', record);
    },


    onDestroy: function() {
        var me = this;

        me.clearResizers();
        me.imgDragger.destroy();
        me.elDragger.destroy();
        me.callParent();
    },


    onWheel: function(event, direction, x, y) {
        this.zoom(direction, x, y);
    },


    onBeforeImgDrag: function(e) {
        this.imgLastXY = e.getXY();

        // allow dragging only if shiftKey is pressed
        return !!e.shiftKey;
    },


    onBeforeElDrag: function(e) {
        this.elCursorStartXY = this.elCursorLastXY = e.getXY();
        if (Ext.fly(e.getTarget()).hasCls(this.selectorClass)) {
            this.draggedSelection = this.getRecord(e.getTarget());
            this.dragMode = 'Dragselection';
        } else {
            this.dragMode = 'Createselection';
        }
    },


    onStartElDrag: function(e) {
        if (this.dragMode == 'Createselection') {
            var me = this,
                originalXY = me.getSelectionOriginalXY(me.elCursorStartXY);

            var records = me.store.add([{x: originalXY[0], y: originalXY[1], w: 0, h: 0}]);
            me.draggedSelection = records[0];
        }
    },


    onElDrag: function(e) {
        this['on' + this.dragMode](e);
    },


    onEndElDrag: function(e) {
        this['on' + this.dragMode + 'End'](e);
    },


    onDragselection: function(e) {
        var xy = e.getXY(),
            lastXY = this.elCursorLastXY,
            zoomFactor = this.zoomFactor,
            record = this.draggedSelection,
            offsetX = this.imgEl.getX(),
            offsetY = this.imgEl.getY(),
            deltaX = Math.round((xy[0] - lastXY[0]) / zoomFactor),
            deltaY = Math.round((xy[1] - lastXY[1]) / zoomFactor);

        if (deltaX) {
            record.set('x', record.get('x') + deltaX);
        }

        if (deltaY) {
            record.set('y', record.get('y') + deltaY);
        }

        if (deltaX || deltaY) {
            this.adjustSelection(record);
            this.elCursorLastXY = e.getXY();
        }
    },


    onDragselectionEnd: function(e) {
        this.fireEvent('selectionupdate', this.draggedSelection);
    },


    onCreateselection: function(e) {
        var xy = e.getXY(),
            startXY = this.elCursorStartXY,
            x = startXY[0],
            y = startXY[1],
            zoomFactor = this.zoomFactor,
            record = this.draggedSelection,
            width = xy[0] - startXY[0],
            height = xy[1] - startXY[1];

        if (width < 0) {
            x = xy[0];
        }

        if (height < 0) {
            y = xy[1];
        }

        var newWidth = Math.round(Math.abs(width)/zoomFactor),
            newHeight = Math.round(Math.abs(height)/zoomFactor),
            newXY = this.getSelectionOriginalXY([x,y]);
            
        record.set({x: newXY[0], y: newXY[1], w: newWidth, h: newHeight});
        this.adjustSelection(record);
    },


    onCreateselectionEnd: function(e) {
        this.fireEvent('selectioncreate', this.draggedSelection);
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
        this.adjustSelections();
    },


    onSizeChange: function() {
        this.adjustSelections();
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


    adjustSelections: function(records) {
        var me = this,
            record;

        if (!records) {
            records = me.store.getRange();
        }

        for (var recordIdx = 0, recordsTotal = records.length;
            recordIdx < recordsTotal; recordIdx++)
        {
            record = records[recordIdx];
            me.adjustSelection(record);
        }
    },


    adjustSelection: function(record) {
        var me = this,
            offsetX = me.geometry.x || 0,
            offsetY = me.geometry.y || 0,
            zoomFactor = me.zoomFactor,
            node = me.getNode(record),
            nodeEl = Ext.fly(node);


            nodeEl.setLeft(Math.round(offsetX + record.get('x') * zoomFactor));
            nodeEl.setTop(Math.round(offsetY + record.get('y') * zoomFactor));
            nodeEl.setWidth(Math.round(record.get('w') * zoomFactor));
            nodeEl.setHeight(Math.round(record.get('h') * zoomFactor));
    }
});
