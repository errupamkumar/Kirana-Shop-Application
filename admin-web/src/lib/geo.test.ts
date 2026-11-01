import { isShortMapsLink, parseLatLng } from './geo'

describe('parseLatLng', () => {
  it('reads typed coordinates with a comma or a space', () => {
    expect(parseLatLng('25.0961, 85.3131')).toEqual({ lat: 25.0961, lng: 85.3131 })
    expect(parseLatLng(' 25.0961 85.3131 ')).toEqual({ lat: 25.0961, lng: 85.3131 })
    expect(parseLatLng('-33.8688,151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 })
  })

  it('rounds to 6 decimals, like the server stores it', () => {
    expect(parseLatLng('25.12345678, 85.98765432')).toEqual({ lat: 25.123457, lng: 85.987654 })
  })

  it('takes the pin (!3d!4d) over the view centre (@) in a Google Maps place link', () => {
    const url = 'https://www.google.com/maps/place/Sharma+Store/@25.1000,85.3000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d25.0961!4d85.3131'
    expect(parseLatLng(url)).toEqual({ lat: 25.0961, lng: 85.3131 })
  })

  it('reads ?q= and @ links, encoded commas and geo: links', () => {
    expect(parseLatLng('https://maps.google.com/?q=25.0961,85.3131')).toEqual({ lat: 25.0961, lng: 85.3131 })
    expect(parseLatLng('https://www.google.com/maps/search/?api=1&query=25.0961%2C85.3131')).toEqual({ lat: 25.0961, lng: 85.3131 })
    expect(parseLatLng('https://www.google.com/maps/@25.0961,85.3131,15z')).toEqual({ lat: 25.0961, lng: 85.3131 })
    expect(parseLatLng('geo:25.0961,85.3131?z=17')).toEqual({ lat: 25.0961, lng: 85.3131 })
  })

  it('reads degrees, minutes and seconds as Google Maps shows a dropped pin', () => {
    expect(parseLatLng(`25°05'46.0"N 85°18'47.2"E`)).toEqual({ lat: 25.096111, lng: 85.313111 })
    expect(parseLatLng(`33°52'07.7"S 151°12'33.5"E`)).toEqual({ lat: -33.868806, lng: 151.209306 })
  })

  it('rejects place names, out-of-range numbers and malformed text', () => {
    expect(parseLatLng('Station Road, Bihar Sharif')).toBeNull()
    expect(parseLatLng('95, 85')).toBeNull()
    expect(parseLatLng('25, 185')).toBeNull()
    expect(parseLatLng('100% sure')).toBeNull()
    expect(parseLatLng('')).toBeNull()
  })
})

describe('isShortMapsLink', () => {
  it('spots short links whose coordinates are hidden behind a redirect', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/AbCdEf123')).toBe(true)
    expect(isShortMapsLink('https://goo.gl/maps/AbCdEf123')).toBe(true)
    expect(isShortMapsLink('https://www.google.com/maps/@25.1,85.3,15z')).toBe(false)
  })
})
