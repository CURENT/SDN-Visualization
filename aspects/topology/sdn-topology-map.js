/*
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

(function (sdnViz) {
    "use strict";

    sdnViz.directive("sdnTopologyMap", function () {
        return {
            restrict: "E",
            replace: true,
            templateUrl: "/templates/topology/sdn-topology-map",
            compile: function () {
                return function (scope, element) {
                    scope.element = element;
                };
            },
            scope: {
                "height": "@",
                "styles": "=",
                "visibilityButton": "@",
                "showInactive": "@"
            },
            controller: function ($scope, $modal, router, repository, messenger, topology, websockets) {
                $scope.showInactive = false;
                var isMapCreated = false;
                var isDataInitialized = false;

                var defaults = _.cloneDeep(topology.defaultParameters);

                $scope.loaded = false;

                $scope.$watch("showInactive", function () {
                    $scope.showInactive = !($scope.showInactive != true && $scope.showInactive != "true");
                    restart();
                });

                $scope.$watch("visibilityButton", function () {
                    $scope.visibilityButton = !($scope.visibilityButton != true && $scope.visibilityButton != "true");
                });

                $scope.toggleActiveNodeVisibility = function () {
                    $scope.showInactive = !$scope.showInactive;
                };

                $scope.resetModel = function() {
                    websockets.publish("/nvm/reset", null, function() {
                        toastr.success("Successfully reset NVM.");
                    });
                };

                $scope.showHelp = function () {
                    $modal.open({
                        templateUrl: "/templates/topology/sdn-topology-help",
                        resolve: {},
                        size: "sm",
                        controller: function ($scope, $modalInstance) {
                            $scope.close = function () {
                                $modalInstance.dismiss('cancel');
                            };
                        },
                        backdrop: true
                    })
                };

                // D3.js Force-Layout Configuration and Behaviour
                var linkStrengthMax = 1;
                var w, h;
                var mapNode, mapInner, svg;
                var nodeSelection, linkSelection, tooltip;

                var force = d3.layout.force()
                    .friction(.8)
                    .linkDistance(1)
                    .linkStrength(function (d) {
                        return ($scope.showInactive || d.link.active) ? 1 : 0;
                    })
                    .on("end", function () {
                        showTopology();
                    });

                var nodeCollection = force.nodes();
                var linkCollection = force.links();

                var tick = function () {
                    nodeSelection.attr("transform", function (d) {
                        return "translate(" + topology.boundingBox(d.x, w) + "," + topology.boundingBox(d.y, h) + ")";
                    });

                    linkSelection
                        .attr("x1", function (d) {
                            return topology.boundingBox(d.source.x, w);
                        })
                        .attr("y1", function (d) {
                            return topology.boundingBox(d.source.y, h);
                        })
                        .attr("x2", function (d) {
                            return topology.boundingBox(d.target.x, w);
                        })
                        .attr("y2", function (d) {
                            return topology.boundingBox(d.target.y, h);
                        });

                    if (force.alpha() < 0.02) {
                        showTopology();
                    }
                };
                force.on("tick", tick);

                var showTopology = function () {
                    if (nodeCollection.length == 0) {
                        return;
                    }

                    if (!$scope.loaded) {
                        mapInner.slideDown(1000);
                        force.alpha(0.1);
                    }

                    $scope.loaded = true;
                    $scope.$digest();
                };

                var hideTopology = function () {
                    $scope.loaded = false;
                    mapInner.slideUp(1000);
                };

                var resize = function () {
                    w = mapNode.width();
                    h = $scope.height || 300;
                    force.size([w, h]);
                    svg.attr({"width": w, "height": h});
                };

                var setMaxStrength = function (val) {
                    linkStrengthMax = Math.max(val, 1);
                };

                // Node and Link Styling
                var styleNode = function (collection) {
                    collection = collection.transition(defaults.animationDuration);
                    if ($scope.styles && $scope.styles.node) {
                        collection = $scope.styles.node(collection);
                    } else {
                        collection = topology.defaultShapeStyle(collection);
                    }
                    collection = collection.filter(function (d) {
                        return d.highlight;
                    }).style({
                        "stroke": defaults.colors.highlight,
                        "fill": defaults.colors.highlight
                    });
                    return collection;
                };

                var styleLink = function (collection) {
                    collection = collection.transition(defaults.animationDuration);
                    if ($scope.styles && $scope.styles.link) {
                        collection = $scope.styles.link(collection, linkStrengthMax);
                    } else {
                        collection = topology.defaultLinkStyle(collection, linkStrengthMax);
                    }
                    collection = collection.filter(function (d) {
                        return d.highlight;
                    }).style("stroke", defaults.colors.highlight);
                    return collection;
                };

                var redrawLinks = function () {
                    if (linkSelection) {
                        var visibleLinks = _.filter(linkCollection, function (d) {
                            return $scope.showInactive || d.link.active;
                        });

                        linkSelection = linkSelection.data(visibleLinks, function (d) {
                            return d.id;
                        });
                        linkSelection.exit().remove();
                        var linkElements = linkSelection.enter().insert("line", ".node");
                        linkSelection
                            .attr("class", function (d) {
                                return "link " + d.type;
                            })
                            .on("contextmenu", function (d) {
                                router.navigate("/detail/link/" + d.id);
                                d3.event.preventDefault();
                            });
                        styleLink(linkSelection);
                        addTooltipToElement(linkElements, "Link");
                    }
                };

                var addTooltipToElement = function (items, type) {
                    items
                        .on("mouseover", function (obj) {
                            tooltip.style("opacity", 0.9);
                            tooltip.html("");
                            if (type == "Node") {
                                defaults.nodeTooltip(obj, tooltip)
                            } else if (type == "Link") {
                                defaults.linkTooltip(obj, tooltip);
                            }
                        })
                        .on("mousemove", function (d) {
                            var topologyWidth = mapNode.width();
                            var tooltipWidth = $(tooltip.node()).width();
                            var tooltipHeight = $(tooltip.node()).height();

                            var x = (type == "Node") ? d.x : ((d.source.x + d.target.x) / 2);
                            var y = (type == "Node") ? d.y : ((d.source.y + d.target.y) / 2);
                            x += defaults.nodeSize - tooltipWidth / 2;
                            y += defaults.nodeSize - tooltipHeight / 2;

                            tooltip
                                .style("left", function () {
                                    return Math.min(x, topologyWidth - tooltipWidth) + "px";
                                })
                                .style("top", y + "px");
                        })
                        .on("mouseout", function (d) {
                            tooltip.style("opacity", 0);
                        });
                };

                var redrawNodes = function () {
                    if (nodeSelection) {
                        var visibleNodes = _.filter(nodeCollection, function (d) {
                            return $scope.showInactive || d.device.active;
                        });
                        nodeSelection = nodeSelection.data(visibleNodes, function (d) {
                            return d.id;
                        });
                        nodeSelection.exit().remove();

                        var groups = nodeSelection.enter().append("g")
                            .attr("class", "node")
                            .attr("width", defaults.nodeSize)
                            .attr("height", defaults.nodeSize)
                            .on("dblclick", function (d) {
                                d.fixed = !d.fixed;
                                if (d.fixed) {
                                    var rd = 3;
                                    d3.select(this).selectAll("circle").remove();
                                    styleNode(d3.select(this).insert("rect", "text")
                                        .attr("x", -defaults.nodeSize)
                                        .attr("y", -defaults.nodeSize)
                                        .attr("rx", rd)
                                        .attr("ry", rd)
                                        .attr("width", defaults.nodeSize * 2)
                                        .attr("height", defaults.nodeSize * 2));
                                } else {
                                    d3.select(this).selectAll("rect").remove();
                                    styleNode(d3.select(this).insert("circle", "text")
                                        .attr("r", defaults.nodeSize));
                                }

                                d3.select(this).classed("fixed", d.fixed);
                                force.start();
                            }).on("contextmenu", function (d) {
                                router.navigate("/detail/device/" + d.id);
                                d3.event.preventDefault();
                            })
                            .call(force.drag);

                        groups.append("circle").attr("r", defaults.nodeSize);
                        groups.append("text").attr("font-size", defaults.iconSize);

                        addTooltipToElement(groups, "Node");

                        var t = svg.selectAll(".node");
                        styleNode(t.selectAll("circle"));
                        styleNode(t.selectAll("rect"));

                        var texts = t.selectAll("text");
                        if ($scope.styles && $scope.styles.text) {
                            $scope.styles.text(texts);
                        } else {
                            topology.defaultTextStyle(texts);
                        }

                        if (nodeCollection.length == 0) {
                            hideTopology();
                        }
                    }
                };

                var restart = function () {
                    redrawLinks();
                    redrawNodes();
                    force.start();
                };

                // Update Handling
                var updateHandler = function (event, message) {
                    if (!isDataInitialized) {
                        return;
                    }

                    var change = message.changes;

                    if ((!change[objectDiff.token.changed]) || (!change[objectDiff.token.value].devices && !change[objectDiff.token.value].links)) {
                        return;
                    }

                    if (change[objectDiff.token.changed] && change[objectDiff.token.value].flows && change[objectDiff.token.value].flows[objectDiff.token.changed]) {
                        blurAll();
                    }

                    setMaxStrength($scope.data.nvm && $scope.data.nvm._internals.drMax);

                    var nodeChangeSet = topology.calculateNodeChangeSet(change, nodeCollection);
                    var linkChangeSet = topology.calculateLinkChangeSet(change, linkCollection);

                    linkChangeSet.remove.forEach(function (link) {
                        linkCollection.splice(linkCollection.indexOf(link), 1);
                    });

                    nodeChangeSet.remove.forEach(function (node) {
                        nodeCollection.splice(nodeCollection.indexOf(node), 1);
                    });

                    nodeChangeSet.add.forEach(function (node) {
                        nodeCollection.push(node);
                    });

                    linkChangeSet.add.forEach(function (link) {
                        link.source = _.find(nodeCollection, function (dt) {
                            return dt.id === link.source;
                        });
                        link.target = _.find(nodeCollection, function (dt) {
                            return dt.id === link.target;
                        });
                        linkCollection.push(link);
                    });

                    if (nodeChangeSet.changed || linkChangeSet.changed) {
                        restart();
                    }
                };

                var subscribeToUpdates = function () {
                    messenger.subscribe({
                        topic: "modelUpdate",
                        callback: function (event, message) {
                            if (isDataInitialized) {
                                hideTopology();
                                _.remove(linkCollection);
                                _.remove(nodeCollection);
                                isDataInitialized = false;
                            }
                            initializeData();
                        }
                    });
                    messenger.subscribe({
                        topic: "modelUpdateDiff",
                        callback: updateHandler
                    });
                    messenger.subscribe({
                        topic: "/topology/device/highlight",
                        callback: highlightDevice
                    });
                    messenger.subscribe({
                        topic: "/topology/device/blur",
                        callback: blurAll
                    });
                    messenger.subscribe({
                        topic: "/topology/link/highlight",
                        callback: highlightLink
                    });
                    messenger.subscribe({
                        topic: "/topology/link/blur",
                        callback: blurAll
                    });
                    messenger.subscribe({
                        topic: "/topology/flow/highlight",
                        callback: highlightFlow
                    });
                    messenger.subscribe({
                        topic: "/topology/flow/blur",
                        callback: blurAll
                    })
                };

                // Bootstrapping Visualization and Data
                var initializeData = function () {
                    if (!isDataInitialized) {
                        $scope.data = repository.data;

                        var nvm = repository.data.nvm;
                        if (nvm) {
                            setMaxStrength((nvm && nvm._internals && nvm._internals.drMax) || 1);

                            var devices = {};
                            nvm.devices.forEach(function (d) {
                                var device = {id: d.id, name: d.name, device: d, x: w / 2, y: h / 2};
                                nodeCollection.push(device);
                                devices[d.id] = device;
                            });

                            nvm.links.forEach(function (d) {
                                var source = devices[d.srcHost.id];
                                var target = devices[d.dstHost.id];
                                if (source && target) {
                                    linkCollection.push({
                                        id: d.id,
                                        source: source,
                                        target: target,
                                        type: d.type,
                                        link: d,
                                        dr: (d.drTx + d.drRx)
                                    });
                                }
                            });
                        }
                        isDataInitialized = true;
                    }
                };

                var highlightDevice = function (event, device) {
                    nodeCollection.forEach(function (d) {
                        if (d.id == device.id) {
                            d.highlight = true;
                        }
                    });
                    redrawNodes();
                };

                var highlightLink = function (event, link) {
                    linkCollection.forEach(function (d) {
                        if (d.id == link.id) {
                            d.highlight = true;
                        }
                    });
                    redrawLinks();
                };

                var highlightFlow = function (event, flow) {
                    console.log(flow);
                    var path = _.map(flow.entries, function(d) { return d.deviceId; });
                    linkCollection.forEach(function (d) {
                        if (_.contains(path, d.source.id) && _.contains(path, d.target.id)) {
                            d.highlight = true;
                        }
                    });
                    redrawLinks();
                };

                var blurAll = function () {
                    nodeCollection.forEach(function (d) {
                        d.highlight = false;
                    });
                    linkCollection.forEach(function (d) {
                        d.highlight = false;
                    });
                    redrawNodes();
                    redrawLinks();
                };

                var createTopologyMap = function () {
                    if ($scope.styles) {
                        if ($scope.styles.nodeSize) {
                            defaults.nodeSize = $scope.styles.nodeSize;
                        }
                        if ($scope.styles.iconSize) {
                            defaults.iconSize = $scope.styles.iconSize;
                        }
                        if ($scope.styles.nodeTooltip) {
                            defaults.nodeTooltip = $scope.styles.nodeTooltip;
                        }
                        if ($scope.styles.linkTooltip) {
                            defaults.linkTooltip = $scope.styles.linkTooltip;
                        }
                    }

                    force.charge(defaults.nodeSize * -100 + 400);

                    mapNode = angular.element($scope.element).find(".map");
                    mapInner = angular.element($scope.element).find(".mapInner");
                    svg = d3.select(mapInner.get(0)).append("svg");

                    tooltip = d3.select(mapNode.get(0)).append("div").attr("class", "topology-tooltip").style("opacity", 0);

                    nodeSelection = svg.selectAll(".node");
                    linkSelection = svg.selectAll(".link");

                    messenger.publish.viewActive({
                        canLeaveCallback: function () {
                            return true;
                        },
                        leaveCallback: function () {
                            $(window).off("resize", resize);
                        }
                    });

                    initializeData();
                    $(window).on("resize", resize);
                    resize();

                    subscribeToUpdates();
                    restart();
                };

                var readyHandlerUnregister = $scope.$watch("element", function () {
                    if (!isMapCreated && $scope.element) {
                        createTopologyMap();
                        readyHandlerUnregister();
                    }
                });
            }
        };
    });
})(window.sdnViz);