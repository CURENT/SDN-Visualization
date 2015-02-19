﻿/*
 * Copyright (c) 2013 - 2015 Saarland University
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * Contributor(s): Andreas Schmidt (Saarland University), Michael Karl (Saarland University)
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 * This license applies to all parts of the SDN-Visualization Application that are not externally
 * maintained libraries. The licenses of externally maintained libraries can be found in /licenses.
 */

(function(sdnViz) {
    "use strict";
    sdnViz.controller("DetailFlowCtrl", function(DetailView, $scope, $routeParams, repository) {
        DetailView.init($scope, $routeParams.id, repository.getFlowById);

        $scope.min = Math.min;

        $scope.$watch("item.entries", function(d) {
            var entries = {};

            for(var i = 0; i < $scope.item.entries.length; i++) {
                var entry = $scope.item.entries[i];
                console.log(entry);
                if(typeof(entries[entry.deviceId]) === "undefined") {
                    entries[entry.deviceId] = {
                        item: repository.getDeviceById(entry.deviceId).item,
                        entries: []
                    };
                }
                entries[entry.deviceId].entries.push(entry);
            }

            $scope.item.devices = _.map(entries, function(d) { return d; });
        }, true);

        $scope.load();
    });
})(window.sdnViz);