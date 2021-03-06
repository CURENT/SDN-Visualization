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
 * Contributor(s): Andreas Schmidt (Saarland University), Philipp S. Tennigkeit (Saarland University), Michael Karl (Saarland University)
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
 * maintained libraries. The licenses of externally maintained libraries can be found in /node_modules and /lib.
 */

(function (nodeRouter) {
    /*jslint node: true */
    "use strict";

    var config = require("./ui-config"),
        moment = require("moment"),
        DBWrapper = require('node-dbi').DBWrapper,
        msgpack = require("../lib/msgpack-javascript/msgpack.codec.js").msgpack,
        passport = require("passport"),
        ensureLoggedIn = require("connect-ensure-login").ensureLoggedIn,
        multipart = require("connect-multiparty"),
        storage = require("./storage");

    var conf = require("./config").getConfiguration();

    var loginUrl = "/login";
    var multipartMiddleware = multipart();
    var dbWrapper = null;

    var index = function (request, response) {
        response.render("index", {demoMode: conf.isDemoMode || false});
    };

    var login = function (req, res) {
        if (!req.user) {
            var credentials = {name: "", pass: ""};
            var demoMode = conf.isDemoMode || false;
            if (demoMode) {
                credentials = conf.credentials;
            }
            res.render('login', {message: req.flash("loginMessage"), demoMode: demoMode, credentials: credentials});
        } else {
            res.redirect("/");
        }
    };

    var connectToDatabase = function () {
        if(dbWrapper === null) {
            var conf = require("./config").getConfiguration();
            if (conf.databaseConnection) {
                dbWrapper = new DBWrapper('pg', conf.databaseConnection);
                dbWrapper.connect();
            }
        }
    };

    var registerTemplates = function (app) {
        app.get("/templates/*", ensureLoggedIn(loginUrl), function (request, response) {
            response.render(request.params[0], {demoMode: conf.isDemoMode || false});
        });
    };

    var registerOtherRoutes = function (app) {
        app.get("/version", function (req, res) {
            res.json({version: require("../package.json").version});
        });

        app.get("/operator", function (req, res) {
            var conf = require("./config").getConfiguration();
            res.redirect(conf.operatorUrl);
        });
    };

    var registerAPI = function (app) {
        app.get("/api/model", ensureLoggedIn(loginUrl), function (request, response) {
            response.json({
                data: msgpack.pack({
                    nvm: storage.getNVM(),
                    checksum: storage.getChecksum()
                }, true)
            });
        });

        app.get("/api/reports/all", ensureLoggedIn(loginUrl), function (request, response) {
            connectToDatabase();
            dbWrapper.fetchAll('SELECT id, created, type FROM report ORDER BY created DESC', null, function (err, result) {
                if (err) {
                    console.log(err);
                    response.json([]);
                } else {
                    response.json(result);
                }
            });
        });

        app.get("/api/reports/type/:type", ensureLoggedIn(loginUrl), function (request, response) {
            connectToDatabase();
            dbWrapper.fetchAll('SELECT id, created, type, sample_start, sample_stop, sample_count, sample_interval, execution_duration FROM report WHERE type=? ORDER BY created DESC', [request.params.type], function (err, result) {
                if (err) {
                    console.log(err);
                    response.json([]);
                } else {
                    response.json(result);
                }
            });
        });

        app.get("/api/reports/:id", ensureLoggedIn(loginUrl), function (request, response) {
            connectToDatabase();
            dbWrapper.fetchRow('SELECT id, created, type, content, sample_start, sample_stop, sample_count, sample_interval, execution_duration FROM report WHERE id=?', [request.params.id], function (err, result) {
                if (err) {
                    console.log(err);
                    response.json({});
                } else {
                    response.json(result);
                }
            });
        });

        app.get("/api/vizConfiguration", ensureLoggedIn(loginUrl), function (request, response) {
            response.json({
                configuration: config.getConfiguration()
            });
        });

        app.get("/api/exportVizConfiguration", ensureLoggedIn(loginUrl), function (request, response) {
            var fileName = "sdn-ui-conf_" + moment(new Date()).format("YYYY_MM_DD_HH_mm_ss") + ".json";
            response.setHeader("Content-disposition", "attachment; filename=" + fileName + "");
            config.attachToResponse(response);
        });

        app.post("/api/importVizConfiguration", multipartMiddleware, ensureLoggedIn(loginUrl), function (request, response) {
            if (request.files && request.files.importConfiguration) {
                var readErrback = function () {
                    console.log("Error while reading uploaded visualization file.");
                };
                config.importConfig(request, readErrback, readErrback, function () {
                    response.redirect("back");
                });
            } else {
                response.redirect("back");
            }
        });
    };

    nodeRouter.init = function (app) {
        app.get("/", ensureLoggedIn(loginUrl), index);
        app.get(loginUrl, login);
        app.get("/logout", function (req, res) {
            req.logout();
            res.redirect("/");
        });
        app.post(loginUrl, passport.authenticate("local", {
            successRedirect: "/",
            successFlash: false,
            failureRedirect: loginUrl,
            failureFlash: true
        }));

        registerTemplates(app);
        registerOtherRoutes(app);
        registerAPI(app);

        app.get("*", ensureLoggedIn(loginUrl), index);
    };
})(exports);