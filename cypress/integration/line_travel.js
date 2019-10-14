function getDateAfterDays (days) {
    Date.prototype.afterDays = function(days) {
        this.setDate(this.getDate() + days)
        return this
    }
    return new Date().afterDays(days)
}

const ROOM_INFORMATION = {
    'rooms': {
        'keyword': '客房數量',
        'count': 1
    },
    'adults': {
        'keyword': '成人',
        'count': 2
    },
    'children': {
        'keyword': '兒童',
        'count': 2,
        'age': [6, 9]
    }
}

const MODIFIED_ROOM_INFORMATION = {
    'rooms': {
        'keyword': '客房數量',
        'count': 2
    },
    'adults': {
        'keyword': '成人',
        'count': 4
    },
    'children': {
        'keyword': '兒童',
        'count': 3,
        'age': [6, 9, 13]
    }
}

const KEYWORD = "東京"
const DAYS_LATER = 30
const FOR_DAYS = 5

function setRoomInformation(data) {
    cy.contains(data.keyword).parent().parent().within(() => {
        cy.get('h3').then(($h3) => {
            const count = data.count
            for (var i = parseInt($h3.text()); i != count; (i<count ? i++ : i--)) {
                if (i < count) {
                    cy.get('.icon-ic_add').click()
                } else {
                    cy.get('.icon-ic_dash').click()
                }
            }
        })
    })
}

function clickOnSelectDatePanel(date) {
    cy.contains(`${date.getFullYear()}年${(date.getMonth()+1)}月`)
      .siblings('.dpbwd-table-items')
      .find('strong.page-table-text')
      .contains(date.getDate())
      .scrollIntoView()
      .click({force: true})
}

describe("Search on the website", function() {
    before("Set search criteria", function() {
        cy.visit("https://travel.line.me")

        // set the search keywords
        cy.get('input[placeholder="輸入城市、地區或住宿名稱"]').click({force: true})
        cy.get('#search_accommodation_keywords_page').find('input').type(`${KEYWORD}{enter}`)

        // set the date
        cy.get('input[placeholder="入住日期"]').click({force: true})
        cy.get('#search_accommodation-select_travel_date_yes-btn').within(() => {
            clickOnSelectDatePanel(getDateAfterDays(DAYS_LATER))
            clickOnSelectDatePanel(getDateAfterDays(DAYS_LATER + FOR_DAYS))
            cy.get('#search_accommodation-select_travel_date_page').click()
        })

        // set the room information
        cy.get('input[placeholder="2 位成人, 1 間客房"]').click({force: true})
        cy.get('#search_accommodation-select_room-panel').within(() => {
            setRoomInformation(ROOM_INFORMATION.rooms)
            setRoomInformation(ROOM_INFORMATION.adults)
            setRoomInformation(ROOM_INFORMATION.children)
            ROOM_INFORMATION.children.age.forEach((age, index) => {
                setRoomInformation({
                    'keyword':`第${index+1}位兒童年齡`,
                    'count':age
                })
            })
            cy.get('#search_accommodation-select_room-yes-btn').click()
        })

        // SEARCH!!!
        cy.contains('搜尋').click()
    })

    it("Check request", function() {
        cy.server()
        cy.route('GET', 'https://linetvl-bypass-api.line-apps.com/api//hotel/price**').as("SearchRequest")
        cy.wait('@SearchRequest').then((xhr) => {
            expect(xhr.url).to.contain('searchId')
            expect(xhr.request.headers.Accept).to.contain('application/json')
            expect(xhr.request.headers.Accept).to.contain('text/plain')
        })
    })

    it("Check search criteria", function() {
        var start_date = getDateAfterDays(DAYS_LATER)
        var end_date = getDateAfterDays(DAYS_LATER + FOR_DAYS)
        const test_data = [
            KEYWORD,
            `${start_date.getMonth()+1}月${(start_date.getDate())}日-${end_date.getMonth()+1}月${(end_date.getDate())}日(${FOR_DAYS} 晚)`,
            `${ROOM_INFORMATION.adults.count+ROOM_INFORMATION.children.count}位旅客`,
            `${ROOM_INFORMATION.rooms.count} 間客房`
        ]

        cy.get('.keyword-item').each(($element, index) => {
            cy.wrap($element).should('contain', test_data[index])
        })
    })

    it("Modify search criteria and check again", function() {
        var start_date = getDateAfterDays(DAYS_LATER)
        var end_date = getDateAfterDays(DAYS_LATER + FOR_DAYS)
        const test_data = [
            KEYWORD,
            `${start_date.getMonth()+1}月${(start_date.getDate())}日-${end_date.getMonth()+1}月${(end_date.getDate())}日(${FOR_DAYS} 晚)`,
            `${MODIFIED_ROOM_INFORMATION.adults.count+MODIFIED_ROOM_INFORMATION.children.count}位旅客`,
            `${MODIFIED_ROOM_INFORMATION.rooms.count} 間客房`
        ]

        cy.get('.keyword-item').first().click().then(($keyword_item) => {
            setRoomInformation(MODIFIED_ROOM_INFORMATION.rooms)
            setRoomInformation(MODIFIED_ROOM_INFORMATION.adults)
            setRoomInformation(MODIFIED_ROOM_INFORMATION.children)
            MODIFIED_ROOM_INFORMATION.children.age.forEach((age, index) => {
                setRoomInformation({
                    'keyword':`第${index+1}位兒童年齡`,
                    'count':age
                })
            })
        })
        cy.get('button[type="submit"].is-primary').click()
        cy.get('.keyword-item').each(($element, index) => {
            cy.wrap($element).should('contain', test_data[index])
        })
    })

    it("check filter", function() {
        cy.get('#search_accommodation-filtering-btn').click()
        cy.get('.page-filter-panel').within(() => {
            cy.get('[type="radio"]').check('9', {force: true})
            cy.contains('確定').click()
        })

        cy.server()
        cy.route('GET', 'https://linetvl-bypass-api.line-apps.com/api//hotel/price**').as("SearchRequest")
        cy.wait('@SearchRequest').then((xhr) => {
            cy.get('.score').each(($score, index) => {
                expect(parseFloat($score.text())).to.be.at.least(9)
            })
        })
    })

    it("Descending order", function() {
        function turnPriceTextToNumber(priceText) {
            return parseInt(priceText.replace("TWD", "").replace(',', ''))
        }
        cy.get('#search_accommodation-ordering-btn').click()
        cy.get('#search_accommodation-price_high_to_low-btn').click()
        var previous_price
        cy.get('.price').each(($price, index) => {
            if (index == 0) {
                previous_price = turnPriceTextToNumber($price.text())
            } else {
                expect(turnPriceTextToNumber($price.text())).to.be.at.most(previous_price)
                previous_price = turnPriceTextToNumber($price.text())
            }
        })
    })

    it("Redirect to check hotel", function() {
        var found_check_hotel = false
        cy.on('url:changed', (e) => {
            if (e.includes('/check-hotel')) {
                found_check_hotel = true
            }
        })
        cy.get('.card').first().invoke('removeAttr', 'target').click().then(() => {
            expect(found_check_hotel).to.be.true
        })
    })
})
