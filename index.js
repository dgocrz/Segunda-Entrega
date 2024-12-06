const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const crypto = require('crypto'); // Para generar sessionString
const app = express();

app.use(express.json());

// Configuración de Sequelize
const sequelize = new Sequelize('database-2', 'admin', 'golazo12', {
    host: 'database-2.cwmamnerktos.us-east-1.rds.amazonaws.com',
    dialect: 'mysql',
});

// Definición de modelos
const Alumno = sequelize.define('Alumno', {
    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    matricula: { type: DataTypes.STRING, allowNull: false },
    promedio: { type: DataTypes.FLOAT, allowNull: false },
    fotoPerfilUrl: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
});

const Profesor = sequelize.define('Profesor', {
    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    numeroEmpleado: { type: DataTypes.STRING, allowNull: false },
    horasClase: { type: DataTypes.INTEGER, allowNull: false },
});

const SesionAlumno = sequelize.define('SesionAlumno', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    fecha: { type: DataTypes.INTEGER, allowNull: false }, // Unix timestamp
    alumnoId: { type: DataTypes.INTEGER, allowNull: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    sessionString: { type: DataTypes.STRING(128), allowNull: false },
});

// Relaciones
Alumno.hasMany(SesionAlumno, { foreignKey: 'alumnoId' });
SesionAlumno.belongsTo(Alumno, { foreignKey: 'alumnoId' });

// Sincronización con la base de datos
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexión con la base de datos establecida exitosamente.');
        await sequelize.sync({ alter: true }); // Crea o actualiza las tablas si es necesario
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error);
    }
});

// Funciones de validación
function validarAlumno(data) {
    const requiredFields = ['nombres', 'apellidos', 'matricula', 'promedio', 'password'];
    for (const field of requiredFields) {
        if (!data[field]) {
            return { isValid: false, message: `El campo ${field} es obligatorio y no puede estar vacío.` };
        }
    }
    if (typeof data.promedio !== 'number') {
        return { isValid: false, message: "El promedio debe ser un número." };
    }
    return { isValid: true };
}

function validarFotoPerfilUrl(data) {
    if (!data.fotoPerfilUrl) {
        return { isValid: false, message: "El campo fotoPerfilUrl es obligatorio." };
    }
    return { isValid: true };
}

// Endpoints para alumnos
app.get('/alumnos', async (req, res) => {
    try {
        const alumnos = await Alumno.findAll();
        res.status(200).json(alumnos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener alumnos' });
    }
});

app.get('/alumnos/:id', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });
        res.status(200).json(alumno);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el alumno' });
    }
});

app.post('/alumnos', async (req, res) => {
    const { isValid, message } = validarAlumno(req.body);
    if (!isValid) return res.status(400).json({ error: message });

    try {
        const alumno = await Alumno.create(req.body);
        res.status(201).json(alumno);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el alumno' });
    }
});

app.put('/alumnos/:id', async (req, res) => {
    const { isValid, message } = validarAlumno(req.body);
    if (!isValid) return res.status(400).json({ error: message });

    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        await alumno.update(req.body);
        res.status(200).json(alumno);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el alumno' });
    }
});

app.delete('/alumnos/:id', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        await alumno.destroy();
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el alumno' });
    }
});

app.post('/alumnos/:id/fotoPerfil', async (req, res) => {
    const { fotoPerfilUrl } = req.body;
    const { isValid, message } = validarFotoPerfilUrl({ fotoPerfilUrl });
    if (!isValid) return res.status(400).json({ error: message });

    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        alumno.fotoPerfilUrl = fotoPerfilUrl;
        await alumno.save();
        res.status(200).json({ message: "Foto de perfil actualizada exitosamente", alumno });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la foto de perfil' });
    }
});

// Endpoints para manejo de sesiones
app.post('/alumnos/:id/session/login', async (req, res) => {
    const { password } = req.body;

    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        if (alumno.password !== password) {
            return res.status(400).json({ error: "Contraseña incorrecta" });
        }

        const sessionString = crypto.randomBytes(64).toString('hex');
        const nuevaSesion = await SesionAlumno.create({
            fecha: Math.floor(Date.now() / 1000),
            alumnoId: alumno.id,
            sessionString,
        });

        res.status(201).json({ message: "Sesión iniciada", session: nuevaSesion });
    } catch (error) {
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

app.post('/alumnos/:id/session/verify', async (req, res) => {
    const { sessionString } = req.body;

    try {
        const sesion = await SesionAlumno.findOne({
            where: { alumnoId: req.params.id, sessionString },
        });

        if (!sesion || !sesion.active) {
            return res.status(400).json({ error: "Sesión inválida o inactiva" });
        }

        res.status(200).json({ message: "Sesión válida" });
    } catch (error) {
        res.status(500).json({ error: 'Error al verificar la sesión' });
    }
});

app.post('/alumnos/:id/session/logout', async (req, res) => {
    const { sessionString } = req.body;

    try {
        const sesion = await SesionAlumno.findOne({
            where: { alumnoId: req.params.id, sessionString },
        });

        if (!sesion) {
            return res.status(400).json({ error: "Sesión no encontrada" });
        }

        sesion.active = false;
        await sesion.save();

        res.status(200).json({ message: "Sesión cerrada exitosamente" });
    } catch (error) {
        res.status(500).json({ error: 'Error al cerrar la sesión' });
    }
});

// Manejo de rutas no encontradas
app.use((req, res, next) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});

// Inicio del servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});
