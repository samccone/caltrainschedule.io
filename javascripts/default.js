(function(){
  "use strict";

  var from, to, when, data = {};

  function is_defined (obj) {
    return typeof(obj) !== "undefined";
  }

  function save_cookies () {
    $.cookie("from", from.getText());
    $.cookie("to", to.getText());
    $.cookie("when", $('.when-button.selected').val());
  }

  function load_cookies () {
    $.cookie.defaults.expires = 365; // expire in one year
    $.cookie.defaults.path = '/'; // available across the whole site
    if (is_defined($.cookie("from"))) {
      from.setText($.cookie("from"));
    };
    if (is_defined($.cookie("to"))) {
      to.setText($.cookie("to"));
    };
    if (is_defined($.cookie("when"))) {
      $('.when-button[value="' + $.cookie("when") + '"]').addClass('selected');
    };
  }

  String.prototype.repeat = function (num) {
    return (num <= 0) ? "" : this + this.repeat(num - 1);
  }

  String.prototype.rjust = function (width, padding) {
    padding = (padding || " ").substr(0, 1); // one and only one char
    return padding.repeat(width - this.length) + this;
  }

  // now in seconds since the midnight
  function now () {
    var date = new Date();
    return date.getHours() * 60 * 60 + date.getMinutes() * 60 + date.getSeconds();
  }

  function second2str (seconds) {
    var minutes = Math.floor(seconds / 60);
    return [
      Math.floor(minutes / 60),
      minutes % 60
    ].map(function(item) {
      return item.toString().rjust(2, '0');
    }).join(':');
  }

  function time_relative (from, to) {
    return Math.round((to - from) / 60); // in minute
  }

  function is_now () {
    return $('.when-button.selected').val() === "now";
  }

  function get_trip_match_regexp () {
    if (is_now()) {
      var now_date = new Date();
      switch (now_date.getDay()) {
        case 1: case 2: case 3: case 4: case 5:
          return /Weekday/i;
        case 6:
          return /Saturday/i;
        case 0:
          return /Sunday/i;
        default:
          alert("now_date.getDay() got wrong: " + now_date.getDay());
          return;
      }
    } else {
      var value = $('.when-button.selected').val();
      if (is_defined(value)) {
        value = value.charAt(0).toUpperCase() + value.substring(1); // capitalize
        return new RegExp(value, "i"); // ignore case
      };
    }
  }

  function compare_trip (a, b) {
    return a.departure_time - b.departure_time;
  }

  function get_trips (services, from_ids, to_ids, trip_reg) {
    return Object.keys(services)
      .filter(function(trip_id) {
        // select certian trip by when
        return trip_reg.test(trip_id);
      }).map(function(trip_id) {
        var service = services[trip_id];
        var i = 0, length = service.length;

        var times = [from_ids, to_ids].map(function(ids) {
          while (i < length) {
            var id = service[i][0];
            var valid = ids.filter(function(tid) { return tid == id; })[0];
            if (is_defined(valid)) {
              return service[i][1];
            };
            ++i;
          };
        });
        if (!is_defined(times[0]) || !is_defined(times[1])) { return; };

        if (!is_now() || times[0] > now()) { // should display by when
          return {
            departure_time: times[0],
            arrival_time: times[1]
          };
        };
      }).filter(function(trip) {
        return is_defined(trip);
      }).sort(compare_trip);
  };

  function render_info (next_train) {
    var info = $("#info").empty();
    if (is_now() && is_defined(next_train)) {
      var next_relative = time_relative(now(), next_train.departure_time);
      info.append('<div class="info">Next train: ' + next_relative + 'min</div>');
    };
  }

  function render_result (trips) {
    var result = $("#result").empty();
    trips.forEach(function(trip) {
      result.append('<div class="trip">' +
                    '<span class="departure">' + second2str(trip.departure_time) + '</span>' +
                    '<span class="duration">' + time_relative(trip.departure_time, trip.arrival_time) + ' min</span>' +
                    '<span class="arrival">' + second2str(trip.arrival_time) + '</span>' +
                    '</div>');
    });
  }

  function schedule () {
    var cities = data.cities, services = data.services;
    var from_ids = cities[from.getText()],
        to_ids = cities[to.getText()],
        trip_reg = get_trip_match_regexp();

    // if some input is invalid, just return
    if (!is_defined(from_ids) || !is_defined(to_ids) || !is_defined(trip_reg)) {
      return;
    };

    var trips = get_trips(services, from_ids, to_ids, trip_reg);

    save_cookies();
    render_info(trips[0]);
    render_result(trips);
  }

  function bind_events () {
    [from, to].forEach(function(c) {
      // when focus, reset input
      c.on("focus", function() {
        c.setText('');
        c.input.Show();
      });
      // when change or complete, schedule
      c.on("change", schedule);
      c.on("complete", schedule);
    });

    when.each(function(index, elem) {
      $(elem).on("click", function() {
        when.each(function(index, elem) {
          $(elem).removeClass("selected");
        });
        $(elem).addClass("selected");
        schedule();
      });
    });

    $("#reverse").on("click", function() {
      var t = from.getText();
      from.setText(to.getText());
      to.setText(t);
      schedule();
    });
  }

  function initialize () {
    // remove 300ms delay for mobiles click
    FastClick.attach(document.body);

    // init inputs elements
    from = rComplete($('#from')[0], { placeholder: "Departure" });
    to = rComplete($('#to')[0], { placeholder: "Destination" });
    when = $('.when-button');

    // generate select options
    var names = Object.keys(data.stops);
    from.setOptions(names);
    to.setOptions(names);

    // init
    data = {
      cities: data.stops,
      services: data.times
    };
    bind_events();
    load_cookies();
    schedule(); // init schedule
  }

  function data_checker (names, callback) {
    var mark = {}, callback = callback;
    names.forEach(function(name) {
      mark[name] = false;
    });

    return function(name) {
      mark[name] = true;

      var all_true = true;
      for (var n in mark)
        if (!mark[n]) {
          all_true = false;
          break;
        };

      if (all_true)
        callback();
    };
  }

  // init after document and data are ready
  var checker = data_checker(["stops", "times"], function() {
    $(initialize);
  });

  // download data
  $.getJSON("data/stops.json", function(stops) {
    data.stops = stops;
    checker("stops");
  });
  $.getJSON("data/times.json", function(times) {
    data.times = times;
    checker("times");
  });

}());
