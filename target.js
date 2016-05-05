var starter_links = [
  "http://www.target.com/c/grocery-essentials/-/N-5xt1a#?lnk=ct_menu_09_1&intc=1865096|null",
  "http://www.target.com/sb/granola-bars-cookies-chips-snacks-grocery-essentials/-/N-4ydo1#?lnk=L1L2_snksc_0208_HERO|HERO|T:Template B-DVM|C:CMS&intc=3204551|null",
  "http://www.target.com/c/breakfast-cereal-grocery-essentials/-/N-5xt0j#?lnk=lnav_ shop categories_4&intc=3331553|null",
  "http://www.target.com/sb/chips-cookies-snacks-grocery-essentials/-/N-5xsy7Z4yc4k#?lnk=L1L2_snksc_0208_HERO|HERO|T:Template B-DVM|C:CMS&intc=3204551|null",
]

var crawlBot = {
  x: null,
  crawling: false,
  crawled: [],
  to_crawl: {
    products: [],
    categories: [],
  },
  catOptions: null,
  catCallback: function(err, ret){},
  _catCallback: function(err, ret) {
    crawlBot.crawling = false
    //console.log(this)
    crawlBot.catCallback(err, ret)
    crawlBot.crawl()
  },
  proOptions: null,
  proCallback: function(err, ret){},
  _proCallback: function(err, ret) {
    crawlBot.crawling = false 
    crawlBot.proCallback(err, ret)
    crawlBot.crawl()
  },
  _cleanLink: function(link) {
    link = link.indexOf("#") == -1 ? link : link.substr(0, link.indexOf("#"))
    link = link.indexOf("?") == -1 ? link : link.substr(0, link.indexOf("?"))
    return link
  },
  pushProduct: function(link) {
    link = crawlBot._cleanLink(link)
    if(crawlBot.crawled.indexOf(link) > -1) return false
    if(crawlBot.to_crawl.products.indexOf(link) == -1) {
      crawlBot.to_crawl.products.push(link)
      return true
    }
    return false
  },
  pushCategory: function(link) {
    link = crawlBot._cleanLink(link)
    if(crawlBot.crawled.indexOf(link) > -1) return false
    if(crawlBot.to_crawl.categories.indexOf(link) == -1) {
      crawlBot.to_crawl.categories.push(link)
      return true
    }
    return false
  },
  crawl: function() {
    if(crawlBot.crawling) return false 
    // Prioritize product pages
    if(crawlBot.to_crawl.products.length) {
      crawlBot.crawling = true
      var url = crawlBot.to_crawl.products.pop()
      crawlBot.crawled.push(url)
      crawlBot.x(url, crawlBot.proOptions)(crawlBot._proCallback)
    } else {
      if(crawlBot.to_crawl.categories.length == 0) {
        console.log("No more categories or products to crawl!")
        crawlBot.finish()
        process.exit()
      }
      crawlBot.crawling = true
      var url = crawlBot.to_crawl.categories.pop()
      crawlBot.crawled.push(url)
      crawlBot.x(url, crawlBot.catOptions)(crawlBot._catCallback)
    }
  },
  finish: function() {},
}

// Setup our CSV writing
var csv = require("fast-csv");
var fs = require("fs")
var csvStream = csv.createWriteStream()
var writeStream = fs.createWriteStream("target-data.csv")
csvStream.pipe(writeStream)
// Setup our crawlers
var xray = require("x-ray");
var phantom = require("x-ray-phantom");
crawlBot.x = xray({
  filters: {
    trim: function (value) {
      return typeof value === "string" ? value.trim() : value
    },
    serve: function(value) {
      if(typeof value === "string") {
        var newv = value.toLowerCase()
        var ind = newv.indexOf("serving size:")
        if(ind !== -1) {
          return value.substr(ind + 13)
        }
      }
      return value
    }
  },
}).driver(phantom({webSecurity:false}))
.throttle(5, 1000)
.concurrency(99)
.delay(0, 2000)

starter_links.forEach(function(item) {
  crawlBot.pushCategory(item)
})

crawlBot.catOptions = ["#Main a[href*='target.com/']@href"]
crawlBot.catCallback = function(err, items) {
  if(items == undefined) return
  items.forEach(function(item) {
      if(item.indexOf("/c/") !== -1 || item.indexOf("/sb/") !== -1) {
        //console.log("Scraping category in search of products...")
        crawlBot.pushCategory(item)
      }
      else if (item.indexOf("/p/") !== -1) {
        crawlBot.pushProduct(item)
      }
  })
}

crawlBot.proOptions = {
  name: "#Main .product-name | trim",
  serving: "#item-nutrition .content:first-child ul li | serve | trim",
  calories: "#Main #item-nutrition .content li p span:contains(Calories:) + span | trim",
  fat: "#Main #item-nutrition .content li p span:contains(Total Fat) + span | trim",
  carbs: "#Main #item-nutrition .content li p span:contains(Total Carbohydrate) + span | trim",
  protein: "#Main #item-nutrition .content li p span:contains(Protein) + span | trim",
}
crawlBot.proCallback = function(err, item) {
  if(typeof item.calories !== "undefined") {
    console.log("Processed " + item.name)
    csvStream.write(item)
  }
}

crawlBot.finish = function() {
  csvStream.end()
}

// Kick things off!
console.log("Scraping Target.com...")
crawlBot.crawl()