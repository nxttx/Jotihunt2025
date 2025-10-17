initAreas();


function initAreas() {
    retrieveAreas();
    setInterval(retrieveAreas, 60 * 1000);
}


async function retrieveAreas() {
    const request = await fetch('https://jotihunt.nl/api/2.0/areas');
    const response = await request.json();
    document.querySelector('.areas').innerHTML = '';
    response.data.forEach(area => {
        let classname = 'huntable_card ' + area.status;
        switch (area.name) {
            case "Alpha":
                classname += " blue_border";
                break;
            case "Bravo":
                classname += " red_border";
                break;
            case "Charlie":
                classname += " yellow_border";
                break;
            case "Delta":
                classname += " green_border";
                break;
            case "Echo":
                classname += " purple_border";
                break;
            case "Foxtrot":
                classname += " pink_border";
                break;
            case "Golf":
                classname += " orange_border";
                break;
            case "Hotel":
                classname += " grey_border";
                break;
        }

        document.querySelector('.areas').innerHTML += `<span class="${classname}">${area.name}</span>`;
    });
}

