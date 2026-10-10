"""Writes each page folder's upload checklist and copy-paste text files.

Run by render.sh after the images exist, so the file lists always match what's on disk.
Taken from Taksis/screenshots/custom-product-pages/src/page_readmes.py, so the two apps'
pages are uploaded the same way.
"""
import os

# page: (reference name, audience, deep link, promotional text)
PAGES = {
    "give": ("Give", "people giving to the church, from the giving tag by the door or a bulletin",
        "spsmconnect:///giving",
        "Make an offering to the church from your phone. Giving goes through Tithe.ly, with Apple Pay, and this week’s services are one tab away."),
    "bookstore": ("Bookstore", "people at the bookstore table or shopping its shelf", "spsmconnect:///bookstore",
        "The church bookstore’s shelf on your phone. Put books in a basket, pay with Apple Pay, and collect them at the church or have them delivered."),
    "week": ("This Week", "parishioners checking what is on and when", "spsmconnect:///calendar",
        "Every service and event at the church this week, and the Liturgy live when you cannot be there. Church forms and giving are in the same app."),
    "newcomers": ("Newcomers", "visitors and anyone new to the Coptic Orthodox Church",
        "spsmconnect:///about/welcome-newcomers",
        "New to the Coptic Orthodox Church? Take the six-station tour before you visit, see this week’s services, and watch a Liturgy live first."),
    "forms": ("Forms", "anyone sent to fill in a church form", "spsmconnect:///forms",
        "The church’s forms, filled in on your phone: register a vehicle, reach the church office, and more. None of them needs an account."),
    "plans": ("Expansion Plans", "parishioners following the building project", "spsmconnect:///about/future-plans",
        "See the three buildings designed for 169 Rice Road and where the work stands, and give toward them from the same app."),
    # The default App Store listing. Not a custom product page, so it has no deep link.
    "listing": ("Default product page", "everyone who finds SPSM Connect on the App Store", None,
        "St. Philopater Mercurius & St. Mina in one app: this week’s services, the Liturgy live, giving, the bookstore and church forms."),
}

# Fields only the default listing has. App Store limits: subtitle 30, keywords 100, description 4000.
LISTING = {
    "subtitle": "Coptic Orthodox in Wayland, MA",
    "keywords": "coptic,orthodox,church,wayland,liturgy,livestream,giving,bookstore,calendar,parish,massachusetts",
    "description": """SPSM Connect is the app of St. Philopater Mercurius & St. Mina, the Coptic Orthodox church in Wayland, Massachusetts. Everything the church keeps online, on your phone.

THIS WEEK
• Every service and event at the church, day by day or by month
• Liturgies, Vespers, Midnight Praises, classes and gatherings
• Servants who sign in see their own rota marked in the calendar

WATCH LIVE
• The Liturgy streams in the app when a service begins
• Recent services are a tap away when nothing is live

GIVING
• Make an offering through Tithe.ly, with Apple Pay
• The church never sees your card details

THE BOOKSTORE
• Browse the church bookstore’s shelf
• Pay with Apple Pay, then collect at the church or have it delivered

CHURCH FORMS
• Register a vehicle so the parking team can reach you
• Contact the church office
• None of them needs an account

SEND A PHOTOGRAPH
• Add your photographs from church events to the parish galleries

ABOUT THE CHURCH
• Who we are, what the Church believes, and our patron saints
• Welcome, newcomers: a six-station tour of the Coptic Orthodox Church
• Our expansion plans: three buildings designed for 169 Rice Road

Plus the week’s notices, the church’s contact details, and its other apps.""",
}
assert len(LISTING["subtitle"]) <= 30, len(LISTING["subtitle"])
assert len(LISTING["keywords"]) <= 100, len(LISTING["keywords"])
assert len(LISTING["description"]) <= 4000, len(LISTING["description"])

# (folder, App Store Connect slot name, size)
SLOTS = [
    ("1-iPhone-6.9", 'iPhone 6.9" display', "1320 × 2868"),
    ("2-iPhone-6.3", 'iPhone 6.1" or 6.3" display', "1206 × 2622"),
    ("3-iPad-13", 'iPad 12.9" or 13" display', "2064 × 2752"),
    ("4-Header-Asset", "Header Asset", "3840 × 1646"),
    ("5-Search-Results-Asset", "Search Results Asset", "3840 × 2560"),
]

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
for page, (ref, audience, link, promo) in PAGES.items():
    assert len(promo) <= 170, f"{page} promotional text is {len(promo)} chars"
    with open(f"{page}/promotional-text.txt", "w") as f:
        f.write(promo + "\n")
    if link:
        with open(f"{page}/deep-link.txt", "w") as f:
            f.write(link + "\n")
    if page == "listing":
        for field, text in LISTING.items():
            with open(f"{page}/{field}.txt", "w") as f:
                f.write(text + "\n")

    steps = []
    for i, (folder, slot, size) in enumerate(SLOTS, 1):
        files = sorted(os.listdir(f"{page}/{folder}"))
        steps.append(f"{i}. **{slot}** ({size}): drag in everything from [`{folder}/`]({folder}) "
                     f"({len(files)} file{'s' if len(files) != 1 else ''})")
    steps.append(f"{len(SLOTS) + 1}. **Promotional text:** paste [`promotional-text.txt`](promotional-text.txt) ({len(promo)} of 170 characters)")
    if link:
        steps.append(f"{len(SLOTS) + 2}. **Deep link:** paste [`deep-link.txt`](deep-link.txt)")
    else:
        n = len(SLOTS) + 2
        for field, label, limit in [("subtitle", "Subtitle", 30), ("keywords", "Keywords", 100), ("description", "Description", 4000)]:
            steps.append(f"{n}. **{label}:** paste [`{field}.txt`]({field}.txt) ({len(LISTING[field])} of {limit} characters)")
            n += 1

    with open(f"{page}/README.md", "w") as f:
        if link:
            title, where = f"{ref}: custom product page", f"""For {audience}. Reference name: `{ref}`.

Upload this in **App Store Connect** (in the browser), not Xcode. Xcode only uploads builds.
Open App Store Connect → SPSM Connect → **Custom Product Pages** → **+**, then fill each slot
from its numbered folder:"""
            deep = f"""

The deep link `{link}` opens SPSM Connect on that screen. It is the same route the app's
own links and `scripts/capture-screenshots.sh` use, so it works in the current build."""
        else:
            title, where = "Default App Store listing", f"""The main product page, the one {audience} sees.

Upload this in **App Store Connect** (in the browser), not Xcode. Xcode only uploads builds.
Open App Store Connect → SPSM Connect → the version you're preparing (**iOS App** in the sidebar),
then fill each slot from its numbered folder:"""
            deep = """

The default listing has no deep link. Those are only for custom product pages."""
        f.write(f"""# {title}

{where}

""" + "\n".join(steps) + f"""

App previews (videos) are optional and aren't included.

[`alternate-5244x2950/`](alternate-5244x2950) has a 16:9 version that either the header
slot or the search results slot accepts, if you'd rather use one image for both.{deep}

These images are generated. To change them, edit [`../src/shots.html`](../src/shots.html)
and run `../src/render.sh` rather than editing the PNGs.
""")
    print(f"wrote {page}/README.md")
