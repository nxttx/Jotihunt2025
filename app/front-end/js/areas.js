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
        document.querySelector('.areas').innerHTML += `<span class="huntable_card ${area.status}">${area.name}</span>`;
    });
}

