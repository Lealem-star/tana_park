import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { clearUser } from "../../reducers/userReducer";
import {Instagram, Github, LinkedinIcon, Mail} from "lucide-react";
import '../../css/layout.scss';

const Layout = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();

    const handleLogout = () => {
        dispatch(clearUser()); //Clear User from Redux Store
    };

    //Protected Path Logic
    useEffect(() => {
        console.log('user ', user);
        if (!user && location.pathname !== '/' && location.pathname !== '/about') {
            navigate('/login')
        }
    }, [user, location, navigate])

    return (
        <div className="main-container">
            {/* Navbar */}
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
                <div className="container">
                    <Link className="navbar-brand" to="/">TanaPark</Link>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="navbarNavDropdown">
                        <ul className="navbar-nav ms-auto align-items-center">
                            <li className="nav-item">
                                <Link className="nav-link" to='/'>Home</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to='/about'>About</Link>
                            </li>
                            {user?.type === "system_admin" &&
                                <>
                                    <li className="nav-item">
                                        <Link className="nav-link" to='/admin/dashboard'>Admin Dashboard</Link>
                                    </li>
                                </>
                            }
                            {user?.type === "valet" &&
                                <>
                                    <li className="nav-item">
                                        <Link className="nav-link" to='/valet/dashboard'>Valet Dashboard</Link>
                                    </li>
                                </>
                            }
                            {user?.type === "admin" &&
                                <>
                                    <li className="nav-item">
                                        <Link className="nav-link" to='/users'>Users</Link>
                                    </li>
                                </>
                            }
                            {user ?
                                <>
                                    <li className="nav-item ms-2">
                                        <Link className="nav-link" to='/profile'><div className="bg-dark px-3 py-2 pointer">{user?.name && user?.name[0]}</div></Link>
                                    </li>
                                    <li className="nav-item">
                                        <button className="btn btn-outline-info " onClick={handleLogout}>Logout</button>
                                    </li>
                                </>
                                :
                                <li className="nav-item ms-4">
                                    <Link className="btn btn-outline-info " to='/login'>Login</Link>
                                </li>
                            }
                        </ul>
                    </div>
                </div>
            </nav>

            {/* Main Content + Speacial React Router Outlet */}
            <main>
                <Outlet />
            </main>

            {/* Footer */}  
            <footer className="container-fluid  mt-5">
                <div className="row">
                    <div className="col-md-4">
                        <p>Copyright &copy; 2026 by Enqopa Technologies Plc</p>
                    </div>
                    <div className="col-md-4">
                    </div>
                    <div className="col-md-4 d-flex justify-content-end">
                        <button type="button" className="btn-link hover:text-blue" aria-label="Instagram">
                        <Instagram />
                        </button>
                        <button type="button" className="btn-link" aria-label="Github">
                        <Github />
                        </button>
                        <button type="button" className="btn-link" aria-label="LinkedIn">
                        <LinkedinIcon />
                        </button>
                        <a href="mailto:enqopatechplc@gmail.com" aria-label="Email">
                        <Mail />
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    )
};

export default Layout;